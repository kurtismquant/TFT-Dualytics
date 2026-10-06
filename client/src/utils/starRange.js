// Pure helpers for the unit page's star-level range: no React, no DOM.
// The server stores raw per-star totals (byStar: { '1': {...}, '2': ..., '3': ... })
// so any contiguous range can be summed and its averages re-derived here.

export const STAR_LEVELS = [1, 2, 3]
export const FULL_STAR_RANGE = { min: 1, max: 3 }

function clampStar(value) {
  if (String(value).trim() === '') return null
  const star = Math.trunc(Number(value))
  if (!Number.isFinite(star)) return null
  return Math.min(3, Math.max(1, star))
}

// '2-3' -> { min: 2, max: 3 }; '2' -> { min: 2, max: 2 }. Missing or invalid
// input falls back to the full range; reversed input is swapped.
export function parseStarsParam(value) {
  const [low, high = low] = String(value ?? '').split('-').map(clampStar)
  if (low == null || high == null) return FULL_STAR_RANGE
  return { min: Math.min(low, high), max: Math.max(low, high) }
}

// null for the full range so the default URL stays clean.
export function serializeStarsParam(range) {
  if (range.min === 1 && range.max === 3) return null
  return range.min === range.max ? String(range.min) : `${range.min}-${range.max}`
}

export function isFullStarRange(range) {
  return range.min === 1 && range.max === 3
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
  const { games } = totals
  return {
    games,
    threeItemGames: totals.threeItemGames,
    avgPlacement: games > 0 ? totals.placementTotal / games : null,
    winRate: games > 0 ? totals.wins / games : null,
    top2Rate: games > 0 ? totals.top2 / games : null,
  }
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
