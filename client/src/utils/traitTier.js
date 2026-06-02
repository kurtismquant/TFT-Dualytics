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
