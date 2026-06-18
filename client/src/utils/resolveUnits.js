// Attaches resolved champion + item metadata to a list of raw units.
// Single source of truth for both the Comps view (comp-row) and Match history
// (match-table). The item matcher accepts either an apiName string (comps store
// item apiNames) or a numeric/string id (match docs store item ids), so it is a
// superset of the two previous implementations.
const FALLBACK_CHAMPION = (id) => ({ id, name: id, cost: 1, iconUrl: '', traits: [] })

// Thief's Gloves fills all three item slots but is stored alphabetically, which
// lands it in the last (right-most) slot behind empty placeholders. Show it in
// the first slot instead — purely a display-order tweak.
const THIEFS_GLOVES = 'TFT_Item_ThiefsGloves'

function orderItemKeys(keys) {
  const list = keys || []
  const idx = list.findIndex(key => key === THIEFS_GLOVES)
  if (idx <= 0) return list
  const reordered = list.slice()
  const [tg] = reordered.splice(idx, 1)
  reordered.unshift(tg)
  return reordered
}

export function resolveUnits(units, champions, items) {
  return (units || []).map(u => {
    const resolved = orderItemKeys(u.items).map(key =>
      items?.find(i => i.apiName === key || i.id === key || i.id === String(key)) || null
    )
    // Fill slots left-to-right: real items first, empty slots (unresolved
    // placeholders like EmptyBag) pushed to the right.
    return {
      ...u,
      champion: champions?.find(c => c.id === u.id) || FALLBACK_CHAMPION(u.id),
      resolvedItems: [...resolved.filter(Boolean), ...resolved.filter(it => !it)],
    }
  })
}
