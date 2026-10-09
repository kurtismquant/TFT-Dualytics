// Board explorer filters ↔ URL (?u=&t=&i=) and API params (units=&traits=&items=).
// Both use one compact format, parsed on the server by boardExplorer.parseExplorerQuery:
//   units:  DA_18_Ahri:2-3:DA_InfinityEdge+DA_GiantSlayer,DA_18_Sett
//   traits: DA_18_Blossom:2        (minimum active tier)
//   items:  DA_RabadonsDeathcap
export const MAX_EXPLORER_FILTERS = 6
export const MAX_UNIT_ITEMS = 3
export const EMPTY_FILTERS = { units: [], traits: [], items: [] }

const ID = /^[A-Za-z0-9_]{1,64}$/
const star = value => (Number.isInteger(value) && value >= 1 && value <= 3 ? value : null)

const list = value => (value ? String(value).split(',').filter(Boolean).slice(0, MAX_EXPLORER_FILTERS) : [])

function parseUnit(entry) {
  const [id, stars = '', items = ''] = entry.split(':')
  if (!ID.test(id)) return null
  const [min, max] = stars.split('-').map(Number)
  const unit = { id, items: items.split('+').filter(item => ID.test(item)).slice(0, MAX_UNIT_ITEMS) }
  if (star(min)) unit.minStar = min
  if (star(max)) unit.maxStar = max
  return unit
}

function parseTrait(entry) {
  const [id, tier] = entry.split(':')
  if (!ID.test(id)) return null
  const minTier = Number(tier)
  return Number.isInteger(minTier) && minTier >= 1 ? { id, minTier } : { id }
}

export function parseExplorerParams(searchParams) {
  return {
    units: list(searchParams.get('u')).map(parseUnit).filter(Boolean),
    traits: list(searchParams.get('t')).map(parseTrait).filter(Boolean),
    items: list(searchParams.get('i')).filter(id => ID.test(id)),
  }
}

function serializeUnit(unit) {
  const hasStars = unit.minStar || unit.maxStar
  const stars = hasStars ? `${unit.minStar || 1}-${unit.maxStar || 3}` : ''
  const items = (unit.items || []).join('+')
  if (items) return `${unit.id}:${stars}:${items}`
  return stars ? `${unit.id}:${stars}` : unit.id
}

const serializeTrait = trait => (trait.minTier ? `${trait.id}:${trait.minTier}` : trait.id)

// → { units, traits, items } strings, empty kinds omitted.
export function serializeFilters(filters) {
  const out = {}
  if (filters.units.length) out.units = filters.units.map(serializeUnit).join(',')
  if (filters.traits.length) out.traits = filters.traits.map(serializeTrait).join(',')
  if (filters.items.length) out.items = filters.items.join(',')
  return out
}

// Same strings under the short URL keys.
export function filtersToSearch(filters) {
  const { units, traits, items } = serializeFilters(filters)
  const params = new URLSearchParams()
  if (units) params.set('u', units)
  if (traits) params.set('t', traits)
  if (items) params.set('i', items)
  return params
}

export const hasFilters = filters => filters.units.length + filters.traits.length + filters.items.length > 0
