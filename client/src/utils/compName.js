// Generates a short (< 25 char) human-readable name for a comp.
//
// Algorithm (deterministic, no LLM): "{Trait} {Unit}", where the trait is the
// comp's non-unique trait with the highest unit count (NOT the highest tier —
// "5 Meeple" beats "3 Arbiter" even though Arbiter's tier is higher) and the
// unit is the carry that holds items the majority of the time. Pure module — no
// React/DOM — so it is unit-testable with `node --test`.

const MAX_LEN = 24

// Traits held by exactly one champion in the set are "unique" traits — they add
// no signal to a comp name and clutter the trait chip row, so we drop them.
//
// champion.traits hold trait DISPLAY NAMES (e.g. "Academy"), but match/comp trait
// ids are Riot apiNames (e.g. "TFT17_Academy"). Map name → id via the trait
// metadata so the returned Set matches the t.id the chip filters check against —
// otherwise it never intersects and nothing is excluded.
export function getUniqueTraitIds(champions, traits = []) {
  const nameToId = new Map((traits || []).map(t => [t.name, t.id]))
  const counts = new Map()
  for (const champ of champions || []) {
    for (const traitName of champ.traits || []) {
      counts.set(traitName, (counts.get(traitName) || 0) + 1)
    }
  }
  const unique = new Set()
  for (const [traitName, count] of counts) {
    if (count !== 1) continue
    unique.add(nameToId.get(traitName) ?? traitName) // fall back to raw name if no metadata
  }
  return unique
}

function truncate(name) {
  const trimmed = String(name || '').trim()
  return trimmed.length > MAX_LEN ? trimmed.slice(0, MAX_LEN).trim() : trimmed
}

export function generateCompName(comp, { champions = [], traits = [], uniqueTraitIds } = {}) {
  const unique = uniqueTraitIds || getUniqueTraitIds(champions, traits)
  const traitName = new Map((traits || []).map(t => [t.id, t.name]))
  const championById = new Map((champions || []).map(c => [c.id, c]))

  const compTraits = (comp?.traits || []).filter(t => !unique.has(t.id))

  const traitLabel = t => traitName.get(t.id) || t.id

  // Trait = highest unit count, NOT highest tier. Ties broken by tier (style),
  // then alphabetically by name for a deterministic result.
  const topTrait = compTraits.reduce((best, t) => {
    if (!best) return t
    if (t.numUnits !== best.numUnits) return t.numUnits > best.numUnits ? t : best
    if (t.style !== best.style) return t.style > best.style ? t : best
    return traitLabel(t) < traitLabel(best) ? t : best
  }, null)

  // Unit = the carry itemized the majority of the time. The aggregator only
  // fills a unit's `items` when it held a full item set in >= half the games, so
  // `items.length > 0` already means "itemized most of the time". When more than
  // one unit qualifies, the higher-cost unit is the primary carry.
  const units = comp?.units || []
  const carries = units
    .filter(u => (u.items?.length || 0) > 0)
    .map(u => ({ unit: u, champ: championById.get(u.id) }))
    .sort((a, b) =>
      (b.unit.items.length - a.unit.items.length) ||
      ((b.champ?.cost || 0) - (a.champ?.cost || 0))
    )

  // No itemized unit → fall back to the highest-cost unit in the comp.
  const fallbackUnit = units
    .map(u => ({ unit: u, champ: championById.get(u.id) }))
    .sort((a, b) => (b.champ?.cost || 0) - (a.champ?.cost || 0))[0]

  const topUnit = carries[0] || fallbackUnit
  const unitLabel = topUnit ? (topUnit.champ?.name || topUnit.unit.id) : null

  // Compose "{Trait} {Unit}", dropping whichever part is missing.
  const parts = [topTrait ? traitLabel(topTrait) : null, unitLabel].filter(Boolean)
  return truncate(parts.length ? parts.join(' ') : 'Flex Comp')
}
