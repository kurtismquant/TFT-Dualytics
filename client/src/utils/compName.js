// Generates a short (< 25 char) human-readable name for a comp.
//
// Algorithm (deterministic, no LLM): prefer the comp's strongest non-unique
// trait when it reaches gold tier or better; otherwise describe the comp's
// carry units (the units that hold items most of the time). Pure module — no
// React/DOM — so it is unit-testable with `node --test`.

// Trait style numbers, per components/ui/TraitChip.module.css:
//   1 bronze, 2 silver, 3 ruby, 4 gold, 5 prismatic, 6 cyan
const GOLD_STYLE = 4
const MAX_LEN = 24

// Trait ids held by exactly one champion in the set are "unique" traits — they
// add no signal to a comp name and clutter the trait chip row, so we drop them.
export function getUniqueTraitIds(champions) {
  const counts = new Map()
  for (const champ of champions || []) {
    for (const traitId of champ.traits || []) {
      counts.set(traitId, (counts.get(traitId) || 0) + 1)
    }
  }
  const unique = new Set()
  for (const [traitId, count] of counts) {
    if (count === 1) unique.add(traitId)
  }
  return unique
}

function truncate(name) {
  const trimmed = String(name || '').trim()
  return trimmed.length > MAX_LEN ? trimmed.slice(0, MAX_LEN).trim() : trimmed
}

export function generateCompName(comp, { champions = [], traits = [], uniqueTraitIds } = {}) {
  const unique = uniqueTraitIds || getUniqueTraitIds(champions)
  const traitName = new Map((traits || []).map(t => [t.id, t.name]))
  const championById = new Map((champions || []).map(c => [c.id, c]))

  const compTraits = (comp?.traits || []).filter(t => !unique.has(t.id))

  // Highest-tier trait wins; ties broken by unit count.
  const topTrait = compTraits.reduce((best, t) => {
    if (!best) return t
    if (t.style !== best.style) return t.style > best.style ? t : best
    return t.numUnits > best.numUnits ? t : best
  }, null)

  const traitLabel = t => traitName.get(t.id) || t.id

  // 1) Gold-or-better trait → name after that trait.
  if (topTrait && topTrait.style >= GOLD_STYLE) {
    const name = traitLabel(topTrait)
    const withCount = `${topTrait.numUnits} ${name}`
    return truncate(withCount.length <= MAX_LEN ? withCount : name)
  }

  // 2) Otherwise describe the carries (units that hold items most of the time).
  const carries = (comp?.units || [])
    .filter(u => (u.items?.length || 0) > 0)
    .map(u => ({ unit: u, champ: championById.get(u.id) }))
    .sort((a, b) =>
      (b.unit.items.length - a.unit.items.length) ||
      ((b.champ?.cost || 0) - (a.champ?.cost || 0))
    )

  const carryName = c => c.champ?.name || c.unit.id

  if (carries.length >= 2) {
    const two = `${carryName(carries[0])} ${carryName(carries[1])}`
    return truncate(two.length <= MAX_LEN ? two : carryName(carries[0]))
  }
  if (carries.length === 1) {
    const withSuffix = `${carryName(carries[0])} Carry`
    return truncate(withSuffix.length <= MAX_LEN ? withSuffix : carryName(carries[0]))
  }

  // 3) Fallbacks: best trait of any tier, else highest-cost unit.
  if (topTrait) return truncate(`${topTrait.numUnits} ${traitLabel(topTrait)}`)
  const topUnit = (comp?.units || [])
    .map(u => championById.get(u.id))
    .filter(Boolean)
    .sort((a, b) => (b.cost || 0) - (a.cost || 0))[0]
  return truncate(topUnit?.name || 'Flex Comp')
}
