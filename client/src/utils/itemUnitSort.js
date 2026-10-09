// Sorting for the item page's units table. Lower is better for avg placement
// and delta, so those ascend on first click; rates and game counts descend.
export const DEFAULT_ITEM_UNIT_SORT = { key: 'avgPlacement', direction: 'asc' }

const FIRST_DIRECTION = { avgPlacement: 'asc', delta: 'asc' }

export function nextItemUnitSort(current, columnKey) {
  if (current.key === columnKey) {
    return { key: columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key: columnKey, direction: FIRST_DIRECTION[columnKey] || 'desc' }
}

// Ties fall back to more games first, then unit id for a stable order.
export function sortItemUnits(rows, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1
  return rows.slice().sort((a, b) => {
    const diff = Number(a[sort.key] ?? 0) - Number(b[sort.key] ?? 0)
    if (diff !== 0) return direction * diff
    return b.count - a.count || a.unitId.localeCompare(b.unitId)
  })
}
