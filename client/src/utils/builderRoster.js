// Units that always take a trait "form" in game. CDragon lists the base unit
// ("Lux", Avatar only) plus one entry per form ("Lux (Blossom)", traits
// Blossom + Avatar). In game the base never appears on a board, so the builder
// drops it and names the forms "Blossom Lux".
// Set 18 Lux: a form counts formTraitWeight times toward its form trait
// (Blossom Lux = 2 Blossom) but only once toward the base trait (Avatar).
// Set-specific: update when the set changes.
const TRAIT_FORM_UNITS = {
  DA_Lux18_Base: { formTraitWeight: 2 },
}

const FORM_NAME_RE = /^(.+?)\s*\((.+)\)$/

export function toBuilderRoster(champions) {
  const formOf = new Map() // form champion id -> { base, weight }
  const baseIds = new Set()

  for (const [baseId, { formTraitWeight }] of Object.entries(TRAIT_FORM_UNITS)) {
    const base = champions.find(c => c.id === baseId)
    if (!base) continue
    baseIds.add(baseId)
    for (const c of champions) {
      if (c.id !== baseId && c.name.startsWith(`${base.name} (`)) {
        formOf.set(c.id, { base, weight: formTraitWeight })
      }
    }
  }

  return champions
    .filter(c => !baseIds.has(c.id))
    .map(c => {
      const form = formOf.get(c.id)
      if (!form) return c
      const match = FORM_NAME_RE.exec(c.name)
      const name = match ? `${match[2]} ${match[1]}` : c.name
      const baseTraits = new Set(form.base.traits || [])
      const traitWeights = Object.fromEntries(
        (c.traits || []).filter(t => !baseTraits.has(t)).map(t => [t, form.weight]),
      )
      return { ...c, name, traitWeights }
    })
}
