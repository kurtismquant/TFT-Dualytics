// pct = show "%" suffix (for stats that are inherently percentages)
export const STAT_DISPLAY = {
  AD:           { label: 'AD',           icon: 'ad' },
  AttackDamage: { label: 'AD',           icon: 'ad' },
  AP:           { label: 'AP',           icon: 'ap' },
  AbilityPower: { label: 'AP',           icon: 'ap' },
  ManaRegen:    { label: 'Mana Regen',   icon: 'mana' },
  Mana:         { label: 'Mana Regen',   icon: 'mana' },
  Health:       { label: 'Health',       icon: 'hp' },
  HP:           { label: 'Health',       icon: 'hp' },
  Armor:        { label: 'Armor',        icon: 'armor' },
  MagicResist:  { label: 'Magic Resist', icon: 'mr' },
  MR:           { label: 'Magic Resist', icon: 'mr' },
  AttackSpeed:  { label: 'Attack Speed', icon: 'as',         pct: true },
  AS:           { label: 'Attack Speed', icon: 'as',         pct: true },
  Durability:   { label: 'Durability',   icon: 'durability', pct: true },
  Range:        { label: 'Range',        icon: 'range' },
  CritChance:   { label: 'Crit Chance',  icon: 'crit',       pct: true },
  CritDamage:   { label: 'Crit Damage',  icon: 'critdmg',    pct: true },
  DamageAmp:    { label: 'Damage Amp',   icon: 'amp',        pct: true },
  Omnivamp:     { label: 'Omnivamp',     icon: 'omnivamp',   pct: true },
}

export const round2 = (n) => Math.round(n * 100) / 100

// Values < 1 are stored as fractions by CDragon (0.10 = 10%) — normalize to percent first.
// Stats from the TFT client say outright whether they're a percentage (`isPercent`).
export function formatStatValue(value, pct, isPercent) {
  if (value == null) return null
  if (isPercent) return `+${round2(value * 100)}%`
  const scaled = value > 0 && value < 1 ? round2(value * 100) : round2(value)
  return pct ? `+${scaled}%` : `+${scaled}`
}

// The item's flat stat bonuses that have a known label: [{ label, icon, value }].
export function visibleItemStats(item) {
  return (item?.effects || [])
    .filter(e => e.name && e.value != null && STAT_DISPLAY[e.name])
    .map(e => {
      const { label, icon, pct } = STAT_DISPLAY[e.name]
      return { label, icon, value: formatStatValue(e.value, pct, e.percent) }
    })
    .filter(stat => stat.value)
}

// The item's two components (resolved against the full item list), or [].
export function itemComponents(item, allItems) {
  const components = (item?.composition || [])
    .map(id => (allItems || []).find(i => i.id === id))
    .filter(Boolean)
  return components.length === 2 ? components : []
}
