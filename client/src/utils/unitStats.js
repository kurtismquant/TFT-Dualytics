// How a unit's base stats grow with star level. Health ×1.8 per star (the TFT
// client's CT_UnitStatMultiplier_PerStarLevel table); attack damage ×1.5 per
// star (every Set 18 unit's AutoAttackDamage row, e.g. Ahri 40/60/90). Other
// stats don't change with stars.
export const STAR_HEALTH_MULTIPLIERS = [1, 1.8, 3.24]
export const STAR_DAMAGE_MULTIPLIERS = [1, 1.5, 2.25]

// [1★, 2★, 3★] values of a 1★ base stat, rounded half-up like the game.
export function statByStar(base, multipliers) {
  if (base == null || !Number.isFinite(Number(base))) return null
  return multipliers.map(m => Math.round(Number(base) * m))
}

// "850 / 1530 / 2754", or a single number when every star level is equal.
export function formatStarValues(values) {
  if (!values) return '–'
  const distinct = [...new Set(values)]
  return distinct.length === 1 ? String(distinct[0]) : values.join(' / ')
}
