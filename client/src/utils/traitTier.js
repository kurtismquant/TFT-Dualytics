// Pure helpers for interpreting trait tier metadata from Data Dragon.
//
// A trait's `effects` list contains its tier breakpoints (bronze/silver/...).
// Riot exposes the visual rank via a numeric `style` (1..6). We surface both
// the minimum-units value and the raw style id; the renderer is responsible
// for mapping the style id to a CSS class or gradient.

// Riot tier id (number) -> short style key. Exposed so renderers and tests
// can reference the same vocabulary.
export const TRAIT_STYLE_BY_TIER = {
  1: 'style1',
  2: 'style2',
  3: 'style3',
  4: 'style4',
  5: 'style5',
  6: 'style6',
}

// CDragon effect styles (1 bronze, 3 silver, 4 unique, 5 gold, 6 prismatic)
// -> the match-data style numbers TraitChip.module.css's .styleN classes use
// (1 bronze, 2 silver, 3 unique, 4 gold, 5 prismatic).
export const CHIP_STYLE_BY_EFFECT_STYLE = { 1: 1, 3: 2, 4: 3, 5: 4, 6: 5 }

// A trait's breakpoints in order as [{ minUnits, style }], one per unit count.
// Some traits list two tiers at one count (Rival: 1+ gold beside a 1-1 bronze
// description row); the higher style is the one the game shows, so Rival
// reads "1 > 2", gold at both.
export function traitBreakpoints(meta) {
  const byMin = new Map()
  for (const effect of meta?.effects || []) {
    if ((effect.minUnits ?? 0) <= 0) continue
    const current = byMin.get(effect.minUnits)
    if (!current || (effect.style ?? 0) > (current.style ?? 0)) byMin.set(effect.minUnits, effect)
  }
  return [...byMin.values()]
    .sort((a, b) => a.minUnits - b.minUnits)
    .map(effect => ({ minUnits: effect.minUnits, style: effect.style }))
}

// Returns the activation breakpoint for a given trait tier index (1-based,
// matching the server's `tier` field). Tiers with `minUnits <= 0` are
// filtered out because they represent inactive states, not real breakpoints.
export function getTraitTierInfo(meta, tier) {
  const effects = (meta?.effects || [])
    .filter(e => (e.minUnits ?? 0) > 0)
    .sort((a, b) => a.minUnits - b.minUnits)
  const effect = effects[tier - 1]
  if (!effect) return { minUnits: null, style: null }
  const style = typeof effect.style === 'number' ? TRAIT_STYLE_BY_TIER[effect.style] : null
  return { minUnits: effect.minUnits, style }
}
