// Pure helpers for the unit stats page's item filter: no React, no DOM.

export const MAX_ITEM_FILTERS = 3

// Riot placeholder for an empty slot, never a real item to filter by.
const IGNORED_ITEM_IDS = new Set(['TFT_Item_EmptyBag'])

function normalize(text) {
  return String(text || '').trim().toLowerCase()
}

// True when `comboItems` holds every filter item. Counts matter so that two
// "Bloodthirster" chips only match combos with two Bloodthirsters.
export function comboMatchesFilters(comboItems, filterIds) {
  if (!filterIds.length) return true
  const remaining = new Map()
  for (const id of comboItems) remaining.set(id, (remaining.get(id) || 0) + 1)
  for (const id of filterIds) {
    const left = remaining.get(id) || 0
    if (left === 0) return false
    remaining.set(id, left - 1)
  }
  return true
}

// Match docs store item apiNames; asset ids are Data Dragon ids (equal to the
// apiName for current-set items, numeric for some legacy ones).
export function itemKey(item) {
  return item?.apiName || item?.id
}

// Items the user can pick from. Items seen in this unit's combos come first, and
// win name collisions: the asset list also holds legacy copies of items under
// other ids (same display name), which would never match a combo.
export function buildItemCandidates(allItems, comboItemIds) {
  const inCombos = new Set(comboItemIds)
  const byName = new Map()
  for (const item of allItems || []) {
    const id = itemKey(item)
    if (!item?.name || !id || IGNORED_ITEM_IDS.has(id)) continue
    const candidate = { id, name: item.name, inCombos: inCombos.has(id) }
    const key = normalize(item.name)
    const existing = byName.get(key)
    if (!existing || (candidate.inCombos && !existing.inCombos)) byName.set(key, candidate)
  }
  return [...byName.values()]
}

// 0 = exact name, 1 = name starts with query, 2 = a word starts with it,
// 3 = contains it anywhere, -1 = no match.
function matchTier(name, query) {
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.split(/[\s'-]+/).some(word => word.startsWith(query))) return 2
  if (name.includes(query)) return 3
  return -1
}

// Candidates matching `query`, best first: by match quality, then items this
// unit actually builds, then alphabetically.
export function rankItemMatches(query, candidates, limit = 8) {
  const needle = normalize(query)
  if (!needle) return []
  return candidates
    .map(candidate => ({ candidate, tier: matchTier(normalize(candidate.name), needle) }))
    .filter(entry => entry.tier >= 0)
    .sort((a, b) => a.tier - b.tier
      || Number(b.candidate.inCombos) - Number(a.candidate.inCombos)
      || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map(entry => entry.candidate)
}

// The item Enter adds for the typed text, or null when nothing matches.
export function pickItemMatch(query, candidates) {
  return rankItemMatches(query, candidates, 1)[0] ?? null
}

// `?items=a,b,c` <-> ['a','b','c'], capped at MAX_ITEM_FILTERS.
export function parseItemsParam(value) {
  return String(value || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEM_FILTERS)
}

export function serializeItemsParam(ids) {
  return ids.slice(0, MAX_ITEM_FILTERS).join(',')
}

// id/apiName -> item asset, for resolving combo item keys to names and icons.
export function buildItemLookup(allItems) {
  const lookup = new Map()
  for (const item of allItems || []) {
    if (item?.id != null) lookup.set(String(item.id), item)
    if (item?.apiName) lookup.set(item.apiName, item)
  }
  return lookup
}

// ── Combo table sorting ────────────────────────────────────────────────────
export const DEFAULT_COMBO_SORT = { key: 'avgPlacement', direction: 'asc' }

// First click on a column: avg placement ascends (lower is better), rates and
// game counts descend (higher first).
const COMBO_SORT_DEFAULTS = { avgPlacement: 'asc', winRate: 'desc', top2Rate: 'desc', count: 'desc' }

export function nextComboSort(current, columnKey) {
  if (current.key === columnKey) {
    return { key: columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key: columnKey, direction: COMBO_SORT_DEFAULTS[columnKey] || 'desc' }
}

// Ties fall back to more games first, then a stable item-key order.
export function sortCombos(combos, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1
  return combos.slice().sort((a, b) => {
    const diff = Number(a[sort.key] || 0) - Number(b[sort.key] || 0)
    if (diff !== 0) return direction * diff
    return b.count - a.count || a.items.join('|').localeCompare(b.items.join('|'))
  })
}
