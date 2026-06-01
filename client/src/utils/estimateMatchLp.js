import { lpFromRank, rankFromLp, tierFromAbsoluteLp, APEX_LP_BASE } from './lpFromRank.js'

const TIER_WIDTH = 400
const DAY_MS = 24 * 60 * 60 * 1000

// Mid-tier baseline LP per Double Up team placement (1-4). This is the prior the
// per-player calibration is regularized toward — actual rates are learned from
// the player's own snapshot windows (see calibratePlacementRates).
export const TEAM_LP_BASE = { 1: 50, 2: 25, 3: -25, 4: -50 }

// Provisional (placement) games: the first 5 games of a set. Per Riot they have
// accelerated LP, never lose LP, and can grant up to 100 LP each. Players always
// start the set between Iron II (absLp 200) and Silver IV (absLp 800) BEFORE
// placements (soft MMR reset toward the median).
const PROVISIONAL_GAMES = 5
const PROVISIONAL_LP_CAP = 100
const PROVISIONAL_START_MIN = 200 // Iron II
const PROVISIONAL_START_MAX = 800 // Silver IV
// Accelerated, no-loss seed profile by team placement for placement games.
const PROVISIONAL_BASE = { 1: 80, 2: 55, 3: 25, 4: 10 }

// LP decay (Master and above only). After a 14-game bank empties (1 game/day),
// each further inactive day costs LP at the tier rate. Master/Diamond can't be
// demoted by decay — handled by the tier-floor clamp.
const DECAY_PER_DAY = { MASTER: 50, GRANDMASTER: 150, CHALLENGER: 250 }
const BANK_DAYS = 14

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const lerp = (a, b, t) => a + (b - a) * t

const isWin = placement => placement === 1 || placement === 2
const isLoss = placement => placement === 3 || placement === 4

// 4th-or-better never loses LP, 5th-or-worse never gains. In Double Up this maps
// to: top-2 teams never show a loss, bottom-2 teams never show a gain.
function signClampDelta(placement, delta) {
  const p = Number(placement)
  if (isWin(p)) return Math.max(0, delta)
  if (isLoss(p)) return Math.min(0, delta)
  return delta
}

// LP lost to decay over an inactive gap, given the tier the player sat at.
// Only Master+ decays, and only past the 14-game bank.
function decayForGap(absLp, gapMs) {
  const rate = DECAY_PER_DAY[tierFromAbsoluteLp(absLp)] || 0
  if (!rate || !(gapMs > 0)) return 0
  const days = gapMs / DAY_MS
  return rate * Math.max(0, days - BANK_DAYS)
}

// Season-start LP (before placements), clamped into the Iron II – Silver IV band.
// We lack last-season rank, so position within the band by the player's first
// confirmed (post-placement) snapshot tier: higher placement ⇒ start nearer the
// top of the band.
function seasonStartAnchor(firstSnapAbsLp) {
  const tierIdx =
    firstSnapAbsLp >= APEX_LP_BASE ? 7 : clamp(Math.floor(firstSnapAbsLp / TIER_WIDTH), 0, 6)
  const within = lerp(PROVISIONAL_START_MIN, PROVISIONAL_START_MAX, clamp(tierIdx / 7, 0, 1))
  return clamp(within, PROVISIONAL_START_MIN, PROVISIONAL_START_MAX)
}

// Tier floor on the continuous LP scale: the value a loss cannot push you below.
// Iron→Master cannot demote out of their tier, so the floor is the tier boundary
// (division IV, 0 LP) = tierIdx * 400. Apex (Master+) collapses to Master 0.
// Division drops *within* a tier are still allowed, so only tier boundaries
// (multiples of 400) are floors — never division boundaries.
export function tierFloorOf(absLp) {
  if (!Number.isFinite(absLp)) return 0
  if (absLp >= APEX_LP_BASE) return APEX_LP_BASE
  return Math.max(0, Math.floor(absLp / TIER_WIDTH) * TIER_WIDTH)
}

// A snapshot sitting exactly on a tier floor (division IV, 0 LP) means any loss
// there was clamped to 0 LP — such windows understate real loss rate.
function isAtFloor(absLp) {
  return Math.abs(absLp - tierFloorOf(absLp)) < 1
}

// "Lower ranks gain more / lose less" — there is no published formula, so we
// scale the mid-tier TEAM_LP_BASE by tier: lower tiers get a larger gain prior
// and a smaller loss prior, higher tiers the reverse. Used as the regression
// target and as the sparse-data fallback when there are no windows to learn from.
export function priorsForTier(absLp) {
  const tierIdx =
    absLp >= APEX_LP_BASE ? 7 : clamp(Math.floor(absLp / TIER_WIDTH), 0, 6)
  const t = clamp(tierIdx / 7, 0, 1)
  const gainScale = lerp(1.4, 0.85, t)
  const lossScale = lerp(0.6, 1.2, t)
  return {
    1: TEAM_LP_BASE[1] * gainScale,
    2: TEAM_LP_BASE[2] * gainScale,
    3: TEAM_LP_BASE[3] * lossScale,
    4: TEAM_LP_BASE[4] * lossScale,
  }
}

function snapshotPointsFromRaw(rankSnapshots) {
  return (rankSnapshots || [])
    .map(snap => {
      const ts = new Date(snap.recordedAt).getTime()
      if (!Number.isFinite(ts)) return null
      const absLp = lpFromRank(snap)
      if (absLp == null) return null
      return { ts, absLp }
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)
}

function makePoint(match, absLp, delta) {
  const r = rankFromLp(absLp) || { tier: null, rank: null, leaguePoints: 0 }
  return {
    ts: match.date,
    absLp,
    tier: r.tier,
    rank: r.rank,
    leaguePoints: r.leaguePoints,
    teamPlacement: match.teamPlacement ?? null,
    matchId: match.matchId,
    delta,
  }
}

// Solve a small linear system M x = v via Gaussian elimination with partial
// pivoting. No external dependencies; sized for the 4x4 normal equations below.
function solveLinear(M, v) {
  const n = v.length
  const a = M.map((row, i) => [...row, v[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r
    }
    if (Math.abs(a[piv][col]) < 1e-9) continue
    ;[a[col], a[piv]] = [a[piv], a[col]]
    const d = a[col][col]
    for (let j = col; j <= n; j++) a[col][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = a[r][col]
      for (let j = col; j <= n; j++) a[r][j] -= f * a[col][j]
    }
  }
  return a.map(row => row[n])
}

// Learn this player's effective LP per team placement from their snapshot
// windows. Each between-snapshot window gives one equation
//   n1*x1 + n2*x2 + n3*x3 + n4*x4 = realDelta
// which we fit with ridge-regularized least squares pulling toward tier-scaled
// priors. Recent windows are weighted more (MMR drifts over time) and windows
// whose loss was clamped at a tier floor are down-weighted (they understate
// losses). Returns a { 1,2,3,4 } rate map. With no usable windows it returns the
// tier-scaled priors unchanged.
function calibratePlacementRates(snaps, sortedMatches, skipBeforeTs = -Infinity) {
  const prior = priorsForTier(snaps[snaps.length - 1].absLp)

  const windows = []
  for (let i = 0; i < snaps.length - 1; i++) {
    const a = snaps[i]
    const b = snaps[i + 1]
    // Skip windows overlapping the provisional games — their LP is not MMR-
    // representative (placement wins grant far more LP than rank implies).
    if (a.ts < skipBeforeTs) continue
    const inWin = sortedMatches.filter(m => m.date > a.ts && m.date <= b.ts)
    if (!inWin.length) continue
    const counts = [0, 0, 0, 0]
    for (const m of inWin) {
      const p = Number(m?.teamPlacement)
      if (p >= 1 && p <= 4) counts[p - 1] += 1
    }
    if (!counts.some(c => c > 0)) continue
    windows.push({ counts, realDelta: b.absLp - a.absLp, a, b })
  }

  if (!windows.length) return { ...prior }

  const N = windows.length
  const M = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  const v = [0, 0, 0, 0]
  windows.forEach((w, i) => {
    let weight = Math.pow(0.85, N - 1 - i) // newer windows matter more
    if (isAtFloor(w.a.absLp) || isAtFloor(w.b.absLp)) weight *= 0.2 // clamped loss
    const c = w.counts
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) M[r][k] += weight * c[r] * c[k]
      v[r] += weight * c[r] * w.realDelta
    }
  })

  // Ridge toward the tier-scaled prior. lambda ~ one window's worth of pseudo-
  // data, so sparse players stay near the prior and data-rich players converge
  // to their true rates.
  const lambda = 6
  const priorArr = [prior[1], prior[2], prior[3], prior[4]]
  for (let r = 0; r < 4; r++) {
    M[r][r] += lambda
    v[r] += lambda * priorArr[r]
  }

  const x = solveLinear(M, v)

  // Sanity clamps: placements 1-2 always gain, 3-4 always lose, and gains/losses
  // stay monotonic by placement so a noisy window can't invert a sign.
  let x1 = clamp(x[0], 10, 120)
  let x2 = clamp(x[1], 10, 120)
  let x3 = clamp(x[2], -120, -10)
  let x4 = clamp(x[3], -120, -10)
  if (x2 > x1) x2 = x1 // 1st >= 2nd
  if (x3 < x4) x3 = x4 // 3rd loses less than (>=) 4th
  return { 1: x1, 2: x2, 3: x3, 4: x4 }
}

// Emit one point per match in a single segment between two anchors. Decay is
// applied as downward drift in the gaps (not attributed to games); placement
// games are no-loss and capped; all games obey the per-placement sign rule;
// cumulative LP is clamped to `floor`. When `to` is provided the last match
// snaps exactly onto it (snap-to-truth); otherwise the segment walks forward
// freely (trailing region after the last snapshot).
function emitSegment(points, from, to, inWindow, ctx) {
  const { seedFor, isProvisional, floor } = ctx
  const snapToTruth = to != null

  const seeds = inWindow.map(seedFor)
  const decays = []
  let prevTs = from.ts
  for (const m of inWindow) {
    decays.push(decayForGap(from.absLp, m.date - prevTs))
    prevTs = m.date
  }

  let correction = 0
  if (snapToTruth) {
    const sumSeed = seeds.reduce((s, x) => s + x, 0)
    const totalDecay = decays.reduce((s, x) => s + x, 0)
    const realDelta = to.absLp - from.absLp
    correction = (realDelta + totalDecay - sumSeed) / inWindow.length
  }

  let running = from.absLp
  for (let j = 0; j < inWindow.length; j++) {
    const m = inWindow[j]
    running = Math.max(floor, running - decays[j]) // gap decay drift
    const before = running

    if (snapToTruth && j === inWindow.length - 1) {
      running = to.absLp // land exactly on the snapshot
    } else {
      let intended = seeds[j] + correction
      if (isProvisional(m)) intended = clamp(intended, 0, PROVISIONAL_LP_CAP)
      else intended = signClampDelta(m.teamPlacement, intended)
      running = Math.max(floor, before + intended)
    }
    points.push(makePoint(m, running, running - before))
  }
}

// Build one estimated LP point per match. Snapshots themselves are not emitted
// as points (they only anchor the math).
export function estimateMatchLp(rankSnapshots, matches) {
  const snaps = snapshotPointsFromRaw(rankSnapshots)
  const sortedMatches = [...(matches || [])]
    .filter(m => Number.isFinite(m?.date))
    .sort((a, b) => a.date - b.date)

  if (!sortedMatches.length) return []
  if (!snaps.length) return [] // nothing to anchor on

  // The first 5 games of the set are placements (data is paged back to set
  // release, so the earliest loaded games are the set's first games).
  const provisional = new Set(sortedMatches.slice(0, PROVISIONAL_GAMES))
  const isProvisional = m => provisional.has(m)
  const provisionalEndTs = sortedMatches[Math.min(PROVISIONAL_GAMES, sortedMatches.length) - 1].date

  const rates = calibratePlacementRates(snaps, sortedMatches, provisionalEndTs)
  const rateFor = m => rates[Number(m?.teamPlacement)] ?? 0
  const seedFor = m =>
    isProvisional(m) ? PROVISIONAL_BASE[Number(m?.teamPlacement)] ?? 0 : rateFor(m)

  // Anchors = synthetic season-start (Iron II – Silver IV) + real snapshots.
  // The synthetic anchor turns the formerly-unanchored pre-first-snapshot region
  // into a real climb from the soft-reset floor through the placement games.
  const s0 = {
    ts: Math.min(sortedMatches[0].date, snaps[0].ts) - 1,
    absLp: seasonStartAnchor(snaps[0].absLp),
  }
  const anchors = [s0, ...snaps]

  const points = []

  // Between-anchor segments (each ends on a real anchor → snap-to-truth).
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i]
    const to = anchors[i + 1]
    const inWindow = sortedMatches.filter(m => m.date > from.ts && m.date <= to.ts)
    if (!inWindow.length) continue
    emitSegment(points, from, to, inWindow, {
      seedFor,
      isProvisional,
      floor: tierFloorOf(Math.min(from.absLp, to.absLp)),
    })
  }

  // Trailing region after the last snapshot. The floor is fixed to the last
  // *confirmed* snapshot's tier and never rises with the estimate, so over-shot
  // gains aren't falsely shielded on a later losing streak.
  const last = anchors[anchors.length - 1]
  const post = sortedMatches.filter(m => m.date > last.ts)
  if (post.length) {
    emitSegment(points, last, null, post, {
      seedFor,
      isProvisional,
      floor: tierFloorOf(last.absLp),
    })
  }

  return points.sort((a, b) => a.ts - b.ts)
}
