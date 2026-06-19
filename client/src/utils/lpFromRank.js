// Converts (tier, rank, leaguePoints) into a single continuous numeric LP
// value used for graphing. Each sub-tier is 100 LP wide and each tier has
// 4 divisions, so divisions stack linearly:
//   Iron IV 0LP   = 0
//   Iron I 100LP  = 400
//   Diamond I 100LP = 2700
//   Master 0LP    = 2800   (Master/Grandmaster/Challenger share the same scale)
//
// Master, Grandmaster, and Challenger have no divisions and unbounded LP.
// Riot returns the actual tier label ('MASTER' | 'GRANDMASTER' | 'CHALLENGER')
// per snapshot — the regional GM/Challenger LP cutoffs are dynamic, so we use
// the snapshot's tier field to label points and let the numeric LP run continuous.

const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
]

const APEX_BASE = TIER_ORDER.length * 400 // 2800
// Estimated apex thresholds. Riot's real GM/Challenger cutoffs are dynamic,
// but for graphing we treat GM as starting at 200 LP and Challenger at 500 LP
// above the Master base. LP is continuous through apex — it does not reset
// when crossing into GM or Challenger.
const APEX_GM_OFFSET = 200
const APEX_CHALLENGER_OFFSET = 500

const DIVISION_OFFSET = { IV: 0, III: 100, II: 200, I: 300 }

// Master, Grandmaster, and Challenger have no divisions — Riot still returns
// rank: "I" for them, so callers must check tier (not rank) to detect apex.
export function isApexTier(tier) {
  if (!tier) return false
  const upper = tier.toUpperCase()
  return upper === 'MASTER' || upper === 'GRANDMASTER' || upper === 'CHALLENGER'
}

export function lpFromRank({ tier, rank, leaguePoints }) {
  if (!tier) return null
  const upper = tier.toUpperCase()
  const lp = Number(leaguePoints) || 0
  if (isApexTier(upper)) {
    return APEX_BASE + lp
  }
  const tierIdx = TIER_ORDER.indexOf(upper)
  if (tierIdx < 0) return null
  const divOffset = DIVISION_OFFSET[rank] ?? 0
  return tierIdx * 400 + divOffset + lp
}

const DIVISIONS_BY_OFFSET = ['IV', 'III', 'II', 'I']

// Inverse of lpFromRank: maps an absolute LP value back to {tier, rank, leaguePoints}.
// Used to label estimated per-match points whose absLp is interpolated between snapshots.
export function rankFromLp(absLp) {
  if (absLp == null || !Number.isFinite(absLp)) return null
  if (absLp >= APEX_BASE) {
    const apexLp = Math.max(0, Math.round(absLp - APEX_BASE))
    let tier = 'MASTER'
    if (apexLp >= APEX_CHALLENGER_OFFSET) tier = 'CHALLENGER'
    else if (apexLp >= APEX_GM_OFFSET) tier = 'GRANDMASTER'
    return { tier, rank: null, leaguePoints: apexLp }
  }
  const clamped = Math.max(0, absLp)
  const tierIdx = Math.min(TIER_ORDER.length - 1, Math.floor(clamped / 400))
  const within = clamped - tierIdx * 400
  const divIdx = Math.min(3, Math.floor(within / 100))
  const lp = Math.max(0, Math.min(100, Math.round(within - divIdx * 100)))
  return {
    tier: TIER_ORDER[tierIdx],
    rank: DIVISIONS_BY_OFFSET[divIdx],
    leaguePoints: lp,
  }
}

export function tierFromAbsoluteLp(absLp) {
  if (absLp == null) return null
  if (absLp >= APEX_BASE + APEX_CHALLENGER_OFFSET) return 'CHALLENGER'
  if (absLp >= APEX_BASE + APEX_GM_OFFSET) return 'GRANDMASTER'
  if (absLp >= APEX_BASE) return 'MASTER'
  const idx = Math.min(TIER_ORDER.length - 1, Math.max(0, Math.floor(absLp / 400)))
  return TIER_ORDER[idx]
}

export function formatRankLabel({ tier, rank, leaguePoints }) {
  if (!tier) return 'Unranked'
  const upper = tier.toUpperCase()
  const lp = Number(leaguePoints) || 0
  if (isApexTier(upper)) {
    const pretty = upper.charAt(0) + upper.slice(1).toLowerCase()
    return `${pretty} ${lp} LP`
  }
  const pretty = upper.charAt(0) + upper.slice(1).toLowerCase()
  return `${pretty} ${rank || ''} ${lp} LP`.replace(/\s+/g, ' ').trim()
}

// Tier threshold lines used as horizontal reference lines on the graph.
export const TIER_THRESHOLDS = TIER_ORDER.map((tier, i) => ({
  tier,
  absLp: i * 400,
})).concat([
  { tier: 'MASTER', absLp: APEX_BASE },
  { tier: 'GRANDMASTER', absLp: APEX_BASE + APEX_GM_OFFSET },
  { tier: 'CHALLENGER', absLp: APEX_BASE + APEX_CHALLENGER_OFFSET },
])

export const APEX_LP_BASE = APEX_BASE
