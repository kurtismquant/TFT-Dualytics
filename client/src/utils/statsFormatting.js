// Pure formatting and lookup helpers used by the stats page.
// These contain no React or DOM access and are safe to import anywhere.

export const formatAvg = value => Number(value || 0).toFixed(2)

export const formatPercent = value => `${((value || 0) * 100).toFixed(1)}%`

export function normalizeName(name) {
  return String(name || '').toLowerCase()
}

// Build an id -> item lookup from a list. Used to replace O(n*m) `.find`
// scans inside render loops with O(1) Map lookups.
export function makeMap(list) {
  return new Map((list || []).map(item => [item.id, item]))
}
