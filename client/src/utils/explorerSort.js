// Column sorting for the board explorer's breakdowns. Pure: no React, no DOM.

// Sortable columns and the direction each starts in (best / most played first).
export const EXPLORER_SORT_DEFAULTS = {
  count: 'desc',
  avgPlacement: 'asc',
  winRate: 'desc',
  top2Rate: 'desc',
  delta: 'asc',
}
export const EXPLORER_SORT_KEYS = Object.keys(EXPLORER_SORT_DEFAULTS)
export const DEFAULT_EXPLORER_SORT = { key: 'count', direction: 'desc' }

// Ties fall back to most played, then best average.
export function compareExplorerRows(a, b, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1
  const diff = Number(a[sort.key] ?? 0) - Number(b[sort.key] ?? 0)
  if (diff !== 0) return direction * diff
  return b.count - a.count || a.avgPlacement - b.avgPlacement
}

// Clicking the active column flips it; another column starts in its default direction.
export function nextExplorerSort(current, key) {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: EXPLORER_SORT_DEFAULTS[key] || 'desc' }
}
