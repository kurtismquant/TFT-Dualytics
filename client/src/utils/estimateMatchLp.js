import { lpFromRank, rankFromLp, APEX_LP_BASE } from './lpFromRank.js'

const TIER_WIDTH = 400

// Mid-tier baseline LP per Double Up team placement (1-4). This is the prior the
// per-player calibration is regularized toward — actual rates are learned from
// the player's own snapshot windows (see calibratePlacementRates).
export const TEAM_LP_BASE = { 1: 50, 2: 25, 3: -25, 4: -50 }

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const lerp = (a, b, t) => a + (b - a) * t

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
function calibratePlacementRates(snaps, sortedMatches) {
  const prior = priorsForTier(snaps[snaps.length - 1].absLp)

  const windows = []
  for (let i = 0; i < snaps.length - 1; i++) {
    const a = snaps[i]
    const b = snaps[i + 1]
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

// Build one estimated LP point per match. Snapshots themselves are not emitted
// as points (they only anchor the math).
export function estimateMatchLp(rankSnapshots, matches) {
  const snaps = snapshotPointsFromRaw(rankSnapshots)
  const sortedMatches = [...(matches || [])]
    .filter(m => Number.isFinite(m?.date))
    .sort((a, b) => a.date - b.date)

  if (!sortedMatches.length) return []
  if (!snaps.length) return [] // nothing to anchor on

  const rates = calibratePlacementRates(snaps, sortedMatches)
  const rateFor = m => {
    const p = Number(m?.teamPlacement)
    return rates[p] ?? 0
  }

  const points = []

  // 1) Matches strictly before the first snapshot: walk backward from firstSnap
  //    using calibrated placement rates. Cumulative LP is clamped to the first
  //    snapshot's confirmed tier floor.
  const first = snaps[0]
  const floorPre = tierFloorOf(first.absLp)
  const pre = sortedMatches.filter(m => m.date <= first.ts)
  if (pre.length) {
    let runningAfter = first.absLp
    const reversed = []
    for (let i = pre.length - 1; i >= 0; i--) {
      const m = pre[i]
      const delta = rateFor(m)
      const before = Math.max(floorPre, runningAfter - delta)
      reversed.push({ match: m, absLp: Math.max(floorPre, runningAfter), delta })
      runningAfter = before
    }
    reversed.reverse()
    for (const r of reversed) points.push(makePoint(r.match, r.absLp, r.delta))
  }

  // 2) Windows between consecutive snapshots. Seed each match with its calibrated
  //    rate, distribute the residual so the cumulative line still lands exactly
  //    on snapshot B (snap-to-truth), and clamp interior matches to the tier
  //    floor of the lower bounding snapshot.
  for (let i = 0; i < snaps.length - 1; i++) {
    const a = snaps[i]
    const b = snaps[i + 1]
    const inWindow = sortedMatches.filter(m => m.date > a.ts && m.date <= b.ts)
    if (!inWindow.length) continue
    const floor = tierFloorOf(Math.min(a.absLp, b.absLp))
    const seeds = inWindow.map(rateFor)
    const sumSeed = seeds.reduce((s, x) => s + x, 0)
    const realDelta = b.absLp - a.absLp
    const correction = (realDelta - sumSeed) / inWindow.length
    let running = a.absLp
    for (let j = 0; j < inWindow.length; j++) {
      const m = inWindow[j]
      let absLp
      if (j === inWindow.length - 1) {
        // Snap-to-truth: the last match in the window lands exactly on snapshot B.
        absLp = b.absLp
      } else {
        absLp = Math.max(floor, running + seeds[j] + correction)
      }
      const gain = absLp - running
      points.push(makePoint(m, absLp, gain))
      running = absLp
    }
  }

  // 3) Matches strictly after the last snapshot: walk forward using calibrated
  //    rates. The floor is fixed to the last *confirmed* snapshot's tier and
  //    never rises with the estimate — so if gains over-shoot across a tier
  //    boundary the player hasn't truly earned, a later losing streak can fall
  //    back through it instead of being falsely shielded.
  const last = snaps[snaps.length - 1]
  const floorPost = tierFloorOf(last.absLp)
  const post = sortedMatches.filter(m => m.date > last.ts)
  if (post.length) {
    let running = last.absLp
    for (const m of post) {
      const next = Math.max(floorPost, running + rateFor(m))
      const realized = next - running
      running = next
      points.push(makePoint(m, running, realized))
    }
  }

  return points.sort((a, b) => a.ts - b.ts)
}
