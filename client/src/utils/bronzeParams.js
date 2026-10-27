// Trait Comps filters <-> URL search params, so a search can be bookmarked
// or shared (like the Data Explorer). Defaults are left out of the URL; bad
// values fall back to them. Pure: no React, no DOM.
import { BOARD_SIZES, MAX_EMBLEMS } from './bronzeComps.js'

const MAX_LISTED_IDS = 12
const ID_PATTERN = /^[A-Za-z0-9_' &.-]{1,64}$/ // unit / item ids

export const DEFAULT_FILTERS = Object.freeze({
  size: 8,
  requiredIds: [], // units every comp has; the player's board in board mode
  boardMode: false, // "From my units"
  emblemIds: [], // emblems owned (repeats allowed)
  traitLadder: false, // playstyle: Bronze for Life (false) or Trait Ladder
  choiceTraitsOff: [], // Kha'Zix evolution traits switched off (all on by default)
  excludeChoiceUnits: false, // leave Kha'Zix out entirely
  excludeLegendary: false, // leave 5-cost units out
  hasSpatula: false,
  hasFryingPan: false,
})

// key in the URL for each filter
const KEYS = {
  size: 'n', requiredIds: 'u', boardMode: 'mode',
  emblemIds: 'e', traitLadder: 'play', choiceTraitsOff: 'kzoff', excludeChoiceUnits: 'nokz',
  excludeLegendary: 'no5', hasSpatula: 'sp', hasFryingPan: 'fp',
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
    emblemIds: list(get('emblemIds'), { unique: false, max: MAX_EMBLEMS }),
    traitLadder: get('traitLadder') === 'ladder',
    choiceTraitsOff: list(get('choiceTraitsOff')),
    excludeChoiceUnits: get('excludeChoiceUnits') === '1',
    excludeLegendary: get('excludeLegendary') === '1',
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
  if (filters.emblemIds.length) set('emblemIds', filters.emblemIds.join(','))
  if (filters.traitLadder) set('traitLadder', 'ladder')
  if (filters.choiceTraitsOff.length) set('choiceTraitsOff', filters.choiceTraitsOff.join(','))
  if (filters.excludeChoiceUnits) set('excludeChoiceUnits', '1')
  if (filters.excludeLegendary) set('excludeLegendary', '1')
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
