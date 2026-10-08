// Riot API bug: duplicate unit entries — sometimes every unit appears twice.
// A champion cannot legitimately appear twice on a TFT board, so any duplicate
// character_id signals the bug. Fix: deduplicate by (character_id, sorted itemNames).

// Special non-champion units (spectators/helpers) that Riot reports in units[]
// but that should never appear in stats, comps, or match history displays.
// None known for Set 18 yet — add character_ids here as they're found.
const EXCLUDED_UNIT_IDS = new Set()

// Riot sometimes reports a real unit under a different character_id:
//  - summons / transformed forms, repeated with no items next to the real unit
//    (Elise's spiderlings, Nidalee's cougar forms, Lux's Blossom clones);
//  - Lux's trait forms (Avatar): usually reported as DA_Lux18_Base, but a board
//    occasionally reports the form instead, e.g. DA_18_Lux_Inferno;
//  - an old-style TFT18_ prefix in place of the DA_ id.
// Each alias otherwise surfaces as its own one-game "unit" in stats and comps.
// Map them to the real unit. Set-specific: add new ids here as they turn up
// (a Stats row with a handful of games and an odd id is the usual tell).
const UNIT_ID_ALIASES = new Map([
  ['DA_18_EliseSpider', 'DA_18_Elise'],
  ['TFT18_NidaleeCougar', 'DA_Nidalee18_AP'],
  ['TFT18_Akali', 'DA_18_Akali_AD'],
  ['DA_Lux18_Blackthorn', 'DA_Lux18_Base'],
  ['DA_Lux18_Blossom', 'DA_Lux18_Base'],
  ['DA_18_Lux_Coven', 'DA_Lux18_Base'],
  ['DA_18_Lux_Elderwood', 'DA_Lux18_Base'],
  ['DA_18_Lux_Fae', 'DA_Lux18_Base'],
  ['DA_18_Lux_Inferno', 'DA_Lux18_Base'],
  ['DA_18_Lux_Moonbeam', 'DA_Lux18_Base'],
  ['DA_18_Lux_Primal', 'DA_Lux18_Base'],
  ['DA_18_Lux_Sunbeam', 'DA_Lux18_Base'],
])

export function canonicalUnitId(id) {
  return UNIT_ID_ALIASES.get(id) ?? id
}

// Checks raw ids on purpose: callers use this to halve doubled trait counts, and
// aliasing must not change when that happens.
export function hadUnitDoubling(units) {
  if (!units) return false
  const seen = new Set()
  for (const u of units) {
    if (EXCLUDED_UNIT_IDS.has(u.character_id)) continue
    if (seen.has(u.character_id)) return true
    seen.add(u.character_id)
  }
  return false
}

// Returns units with aliased ids mapped to the real unit (copies; the raw match
// doc is never mutated), excluded units dropped, and doubled entries removed.
// Clones of a real unit collapse into a single copy holding the same items.
export function deduplicateUnits(units) {
  if (!units || units.length === 0) return []
  const canonical = units
    .filter(u => !EXCLUDED_UNIT_IDS.has(u.character_id))
    .map(u => {
      const id = canonicalUnitId(u.character_id)
      return id === u.character_id ? u : { ...u, character_id: id }
    })
  if (!hadUnitDoubling(canonical)) return canonical
  const seen = new Set()
  return canonical.filter(u => {
    const key = `${u.character_id}|${(u.itemNames || []).slice().sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
