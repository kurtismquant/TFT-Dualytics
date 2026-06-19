const RANK_ICON_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/tftmobile/particles'

// Community Dragon regalia icon for a ranked tier
// (e.g. 'DIAMOND' -> .../tft_regalia_diamond.png). Returns null when tier is missing.
export function getRankIconUrl(tier) {
  if (!tier) return null
  return `${RANK_ICON_BASE}/tft_regalia_${tier.toLowerCase()}.png`
}
