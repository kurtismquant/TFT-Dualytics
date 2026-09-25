// Maps CDragon `{{<SET PREFIX>_<TRAIT>_<BUFFNAME>}}` references to their display names.
// Extend this map as new buff references are encountered. Keys are case-insensitive
// (lookup normalizes to UPPER_SNAKE_CASE). Set 18 descriptions don't use any yet.
export const BUFF_NAMES = {}

// Title-case fallback when a reference isn't in the map.
// "DA_18_COVEN_RITUAL" → "Ritual" (best-effort)
export function fallbackBuffName(ref) {
  const tail = ref.split('_').pop() || ref
  if (!tail) return ref
  return tail.charAt(0).toUpperCase() + tail.slice(1).toLowerCase()
}

export function lookupBuffName(ref) {
  if (!ref) return ''
  const key = ref.toUpperCase()
  return BUFF_NAMES[key] || fallbackBuffName(ref)
}
