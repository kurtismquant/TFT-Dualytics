export function getPlacementClass(styles, placement) {
  return {
    1: styles.p1,
    2: styles.p2,
    3: styles.p3,
    4: styles.p4,
  }[placement] || ''
}

export function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatRound(r) {
  if (!r || r < 1) return ''
  if (r <= 3) return `1-${r}`
  const stage = Math.floor((r - 4) / 7) + 2
  const round = ((r - 4) % 7) + 1
  return `${stage}-${round}`
}

export function getTeamPlacement(match) {
  if (match.teamPlacement) return match.teamPlacement
  if (match.placement) return Math.ceil(match.placement / 2)
  return null
}

// Shared unit resolver — single implementation lives in utils/resolveUnits.js.
export { resolveUnits } from '../../utils/resolveUnits.js'

export function calcBoardCost(units, champions) {
  return (units || []).reduce((sum, u) => {
    const champ = champions?.find(c => c.id === u.id)
    const base = champ?.cost || 0
    const mult = u.tier === 3 ? 9 : u.tier === 2 ? 3 : 1
    return sum + base * mult
  }, 0)
}

const RANK_ICON_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/tftmobile/particles'

export function getRankIconUrl(tier) {
  if (!tier) return null
  return `${RANK_ICON_BASE}/tft_regalia_${tier.toLowerCase()}.png`
}

export function formatRankShort(rankInfo) {
  if (!rankInfo?.tier) return null
  const tier = rankInfo.tier.charAt(0).toUpperCase() + rankInfo.tier.slice(1).toLowerCase()
  return `${tier} ${rankInfo.rank} ${rankInfo.leaguePoints}LP`
}
