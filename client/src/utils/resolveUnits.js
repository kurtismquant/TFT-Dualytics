// Attaches resolved champion + item metadata to a list of raw units.
// Single source of truth for both the Comps view (comp-row) and Match history
// (match-table). The item matcher accepts either an apiName string (comps store
// item apiNames) or a numeric/string id (match docs store item ids), so it is a
// superset of the two previous implementations.
const FALLBACK_CHAMPION = (id) => ({ id, name: id, cost: 1, iconUrl: '', traits: [] })

export function resolveUnits(units, champions, items) {
  return (units || []).map(u => ({
    ...u,
    champion: champions?.find(c => c.id === u.id) || FALLBACK_CHAMPION(u.id),
    resolvedItems: (u.items || []).map(key =>
      items?.find(i => i.apiName === key || i.id === key || i.id === String(key)) || null
    ),
  }))
}
