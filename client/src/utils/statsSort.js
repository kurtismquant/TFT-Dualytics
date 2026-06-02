// Sort configuration and comparator for the stats table.
// Pure logic: no React, no DOM.

export const DEFAULT_SORT = { key: 'avgPlacement', direction: 'asc' }

// Per-column initial sort direction when a user switches to a new column.
// Numeric stats descend (best/most-frequent first); name ascends (A->Z).
export const SORT_DEFAULTS = {
  name: 'asc',
  avgPlacement: 'asc',
  winRate: 'desc',
  frequency: 'desc',
}

export function compareRows(a, b, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1
  if (sort.key === 'name') {
    return direction * a.name.localeCompare(b.name)
  }

  const aValue = Number(a[sort.key] || 0)
  const bValue = Number(b[sort.key] || 0)
  if (aValue !== bValue) return direction * (aValue - bValue)
  return a.name.localeCompare(b.name)
}

// Toggle helper: if clicking the active column, flip direction; otherwise
// jump to that column's default direction.
export function nextSort(current, columnKey) {
  if (current.key === columnKey) {
    return { key: columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key: columnKey, direction: SORT_DEFAULTS[columnKey] || 'asc' }
}
