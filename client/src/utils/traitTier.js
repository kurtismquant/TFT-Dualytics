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
// Riot's `tier_current` indexes every effect, hidden ones included — Rival
// reports tier 2 for its 1-1 bronze description row — so the style is the
// one the game shows at that unit count (see traitBreakpoints).
export function getTraitTierInfo(meta, tier) {
  const effects = (meta?.effects || [])
    .filter(e => (e.minUnits ?? 0) > 0)
    .sort((a, b) => a.minUnits - b.minUnits)
  const effect = effects[tier - 1]
  if (!effect) return { minUnits: null, style: null }
  const shown = traitBreakpoints(meta).find(b => b.minUnits === effect.minUnits)
  const style = typeof shown?.style === 'number' ? TRAIT_STYLE_BY_TIER[shown.style] : null
  return { minUnits: effect.minUnits, style }
}

const MAX_POPULAR = 5 // matches the server's statsAggregator cap

const weighted = (a, b, key) => (
  (a[key] ?? 0) * a.count + (b[key] ?? 0) * b.count) / (a.count + b.count)

function mergePopular(a = [], b = []) {
  const counts = new Map()
  for (const { id, count } of [...a, ...b]) counts.set(id, (counts.get(id) || 0) + count)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((x, y) => y.count - x.count || x.id.localeCompare(y.id))
    .slice(0, MAX_POPULAR)
}

// Folds decorated trait stats rows that read the same ("1 Rival") into one:
// Rival's hidden tier 2 would otherwise be a second "1 Rival" row. Keeps the
// bigger row's id/tier so row keys stay unique.
export function mergeTraitTierRows(rows) {
  const merged = new Map()
  const out = []
  for (const row of rows) {
    if (row.tierMin == null) { out.push(row); continue }
    const key = `${row.traitId || row.id}#${row.tierMin}`
    const prev = merged.get(key)
    if (prev === undefined) { merged.set(key, out.length); out.push(row); continue }
    const a = out[prev]
    const [major, minor] = a.count >= row.count ? [a, row] : [row, a]
    out[prev] = {
      ...major,
      count: a.count + row.count,
      frequency: (a.frequency || 0) + (row.frequency || 0),
      avgPlacement: weighted(a, row, 'avgPlacement'),
      winRate: weighted(a, row, 'winRate'),
      avgUnits: a.avgUnits == null && row.avgUnits == null ? null : weighted(a, row, 'avgUnits'),
      popularUnits: mergePopular(major.popularUnits, minor.popularUnits),
    }
  }
  return out
}
