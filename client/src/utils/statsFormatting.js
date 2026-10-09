// Pure formatting and lookup helpers used by the stats page.
// These contain no React or DOM access and are safe to import anywhere.

export const formatAvg = value => Number(value || 0).toFixed(2)

export const formatPercent = value => `${((value || 0) * 100).toFixed(1)}%`

// Signed avg-placement difference, 2 decimals ("−0.12", "+0.05", "0.00").
export function formatDelta(value) {
  const rounded = Number((value || 0).toFixed(2))
  if (rounded === 0) return '0.00'
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(2)}`
}

export function normalizeName(name) {
  return String(name || '').toLowerCase()
}

// Build an id -> item lookup from a list. Used to replace O(n*m) `.find`
// scans inside render loops with O(1) Map lookups.
export function makeMap(list) {
  return new Map((list || []).map(item => [item.id, item]))
}
