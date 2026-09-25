// Riot API bug: duplicate unit entries — sometimes every unit appears twice.
// A champion cannot legitimately appear twice on a TFT board, so any duplicate
// character_id signals the bug. Fix: deduplicate by (character_id, sorted itemNames).

// Special non-champion units (spectators/helpers) that Riot reports in units[]
// but that should never appear in stats, comps, or match history displays.
// None known for Set 18 yet — add character_ids here as they're found.
const EXCLUDED_UNIT_IDS = new Set()

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

export function deduplicateUnits(units) {
  if (!units || units.length === 0) return []
  const filtered = units.filter(u => !EXCLUDED_UNIT_IDS.has(u.character_id))
  if (!hadUnitDoubling(units)) return filtered
  const seen = new Set()
  return filtered.filter(u => {
    const key = `${u.character_id}|${(u.itemNames || []).slice().sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
