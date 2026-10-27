// Trait Comps filters <-> URL search params, so a search can be bookmarked
// or shared (like the Data Explorer). Defaults are left out of the URL; bad
// values fall back to them. Pure: no React, no DOM.
import { BOARD_SIZES, MAX_EMBLEMS } from './bronzeComps.js'

export const MAX_LISTED_IDS = 12
const ID_PATTERN = /^[A-Za-z0-9_' &.-]{1,64}$/ // unit / item ids

export const DEFAULT_FILTERS = Object.freeze({
  size: 8,
  requiredIds: [], // units every comp has; the player's board in board mode
  boardMode: false, // "From my units"
  avoidIds: [], // units no comp may use
  emblemIds: [], // emblems owned (repeats allowed)
  traitLadder: false, // playstyle: Bronze for Life (false) or Trait Ladder
  choiceTraitCount: 4, // Kha'Zix evolutions; 0 = leave him out
  hasSpatula: false,
  hasFryingPan: false,
})

// key in the URL for each filter
const KEYS = {
  size: 'n', requiredIds: 'u', boardMode: 'mode', avoidIds: 'avoid',
  emblemIds: 'e', traitLadder: 'play', choiceTraitCount: 'kz',
  hasSpatula: 'sp', hasFryingPan: 'fp',
}

const list = (value, { unique = true, max = MAX_LISTED_IDS } = {}) => {
  const ids = String(value || '').split(',').map(id => id.trim()).filter(id => ID_PATTERN.test(id))
  return (unique ? [...new Set(ids)] : ids).slice(0, max)
}
const intIn = (value, allowed, fallback) => {
  if (value == null || value === '') return fallback // Number(null) would be 0
  const n = Number(value)
  return Number.isInteger(n) && allowed.includes(n) ? n : fallback
}

// URLSearchParams -> filters
export function parseBronzeParams(params) {
  const get = key => params.get(KEYS[key])
  return {
    size: intIn(get('size'), BOARD_SIZES, DEFAULT_FILTERS.size),
    requiredIds: list(get('requiredIds')),
    boardMode: get('boardMode') === 'board',
    avoidIds: list(get('avoidIds')),
    emblemIds: list(get('emblemIds'), { unique: false, max: MAX_EMBLEMS }),
    traitLadder: get('traitLadder') === 'ladder',
    choiceTraitCount: intIn(get('choiceTraitCount'), [0, 1, 2, 3, 4], DEFAULT_FILTERS.choiceTraitCount),
    hasSpatula: get('hasSpatula') === '1',
    hasFryingPan: get('hasFryingPan') === '1',
  }
}

// filters -> URLSearchParams (non-default values only)
export function bronzeFiltersToSearch(filters) {
  const params = new URLSearchParams()
  const set = (key, value) => params.set(KEYS[key], value)
  if (filters.size !== DEFAULT_FILTERS.size) set('size', filters.size)
  if (filters.requiredIds.length) set('requiredIds', filters.requiredIds.join(','))
  if (filters.boardMode) set('boardMode', 'board')
  if (filters.avoidIds.length) set('avoidIds', filters.avoidIds.join(','))
  if (filters.emblemIds.length) set('emblemIds', filters.emblemIds.join(','))
  if (filters.traitLadder) set('traitLadder', 'ladder')
  if (filters.choiceTraitCount !== DEFAULT_FILTERS.choiceTraitCount) set('choiceTraitCount', filters.choiceTraitCount)
  if (filters.hasSpatula) set('hasSpatula', '1')
  if (filters.hasFryingPan) set('hasFryingPan', '1')
  return params
}

// How many filters differ from the defaults (the mobile "Filters (n)" badge).
export function countActiveFilters(filters) {
  return Object.keys(DEFAULT_FILTERS).filter(key => {
    const value = filters[key]
    const base = DEFAULT_FILTERS[key]
    return Array.isArray(base) ? value.length > 0 : value !== base
  }).length
}
