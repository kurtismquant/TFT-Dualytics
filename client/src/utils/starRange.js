// Pure helpers for the unit page's star-level and item-count ranges: no React,
// no DOM. The server stores raw totals per star (byStar) and per star x items
// held (byStarItems) so any contiguous range can be summed and its averages
// re-derived here.

export const STAR_LEVELS = [1, 2, 3]
export const FULL_STAR_RANGE = { min: 1, max: 3 }
export const ITEM_COUNT_LEVELS = [0, 1, 2, 3]
export const FULL_ITEM_RANGE = { min: 0, max: 3 }

function clampLevel(value, lo, hi) {
  if (String(value).trim() === '') return null
  const level = Math.trunc(Number(value))
  if (!Number.isFinite(level)) return null
  return Math.min(hi, Math.max(lo, level))
}

// '2-3' -> { min: 2, max: 3 }; '2' -> { min: 2, max: 2 }. Missing or invalid
// input falls back to the full range; reversed input is swapped.
function parseRangeParam(value, lo, hi) {
  const [low, high = low] = String(value ?? '').split('-').map(part => clampLevel(part, lo, hi))
  if (low == null || high == null) return { min: lo, max: hi }
  return { min: Math.min(low, high), max: Math.max(low, high) }
}

// null for the full range so the default URL stays clean.
function serializeRangeParam(range, lo, hi) {
  if (range.min === lo && range.max === hi) return null
  return range.min === range.max ? String(range.min) : `${range.min}-${range.max}`
}

export const parseStarsParam = value => parseRangeParam(value, 1, 3)
export const serializeStarsParam = range => serializeRangeParam(range, 1, 3)
export const parseItemCountParam = value => parseRangeParam(value, 0, 3)
export const serializeItemCountParam = range => serializeRangeParam(range, 0, 3)

export function isFullStarRange(range) {
  return range.min === 1 && range.max === 3
}

export function isFullItemRange(range) {
  return range.min === 0 && range.max === 3
}

function levelsIn(range) {
  return STAR_LEVELS.filter(star => star >= range.min && star <= range.max).map(String)
}

function sumFields(byStar, range, fields) {
  const totals = Object.fromEntries(fields.map(field => [field, 0]))
  for (const star of levelsIn(range)) {
    const bucket = byStar?.[star]
    if (!bucket) continue
    for (const field of fields) totals[field] += bucket[field] || 0
  }
  return totals
}

// Unit-level results for the summed star levels. Rates are null with no games.
export function starRangeSummary(byStar, range) {
  const totals = sumFields(byStar, range, ['games', 'placementTotal', 'wins', 'top2', 'threeItemGames'])
  return { games: totals.games, threeItemGames: totals.threeItemGames, ...rates(totals) }
}

function rates(totals) {
  const { games } = totals
  return {
    avgPlacement: games > 0 ? totals.placementTotal / games : null,
    winRate: games > 0 ? totals.wins / games : null,
    top2Rate: games > 0 ? totals.top2 / games : null,
  }
}

// Unit results for boards inside both the star range and the items-held range.
// `threeItemGames` (3-item combo builds) only counts when 3 items is in range.
// Docs without byStarItems fall back to the star range alone.
export function unitRangeSummary({ byStar, byStarItems }, starRange, itemRange) {
  if (!byStarItems) return starRangeSummary(byStar, starRange)
  const totals = { games: 0, placementTotal: 0, wins: 0, top2: 0 }
  for (const star of levelsIn(starRange)) {
    for (const count of ITEM_COUNT_LEVELS) {
      if (count < itemRange.min || count > itemRange.max) continue
      const cell = byStarItems[star]?.[count]
      if (!cell) continue
      for (const field of Object.keys(totals)) totals[field] += cell[field] || 0
    }
  }
  const threeItemGames = itemRange.max === 3
    ? sumFields(byStar, starRange, ['threeItemGames']).threeItemGames
    : 0
  return { games: totals.games, threeItemGames, ...rates(totals) }
}

// Combos re-scored within the star range, dropping any with fewer than
// `minGames` boards inside it. Docs stored before per-star data existed have no
// byStar; they're returned unchanged (the page disables the slider then).
export function combosForStarRange(combos, unitByStar, range, minGames) {
  if (!unitByStar || isFullStarRange(range)) return combos
  const { threeItemGames } = sumFields(unitByStar, range, ['threeItemGames'])
  const ranged = []
  for (const combo of combos) {
    if (!combo.byStar) continue
    const totals = sumFields(combo.byStar, range, ['count', 'placementTotal', 'wins', 'top2'])
    if (totals.count < minGames) continue
    ranged.push({
      ...combo,
      count: totals.count,
      avgPlacement: totals.placementTotal / totals.count,
      winRate: totals.wins / totals.count,
      top2Rate: totals.top2 / totals.count,
      frequency: threeItemGames > 0 ? totals.count / threeItemGames : 0,
    })
  }
  return ranged
}
