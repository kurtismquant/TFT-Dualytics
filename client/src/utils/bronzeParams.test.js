// Run with: node --test client/src/utils/bronzeParams.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { bronzeFiltersToSearch, countActiveFilters, DEFAULT_FILTERS, parseBronzeParams } from './bronzeParams.js'

test('defaults: an empty URL gives the defaults, and the defaults give an empty URL', () => {
  assert.deepEqual(parseBronzeParams(new URLSearchParams()), { ...DEFAULT_FILTERS })
  assert.equal(bronzeFiltersToSearch(DEFAULT_FILTERS).toString(), '')
  assert.equal(countActiveFilters(DEFAULT_FILTERS), 0)
})

test('every filter round-trips through the URL', () => {
  const filters = {
    size: 11,
    requiredIds: ['DA_18_Xayah', 'DA_18_Rakan'],
    boardMode: true,
    emblemIds: ['DA_18_EmblemCoven', 'DA_18_EmblemCoven'],
    traitLadder: true,
    choiceTraitsOff: ['Rapidfire', 'Spellweaver'],
    hasSpatula: true,
    hasFryingPan: true,
  }
  const search = bronzeFiltersToSearch(filters)
  assert.deepEqual(parseBronzeParams(new URLSearchParams(search.toString())), filters)
  assert.equal(countActiveFilters(filters), 8)
})

test('bad values fall back; lists are cleaned, deduped (not emblems) and capped', () => {
  const parsed = parseBronzeParams(new URLSearchParams('n=99&u=A,A,<x>,B&e=E,E&play=x&mode=yes'))
  assert.equal(parsed.size, DEFAULT_FILTERS.size)
  assert.deepEqual(parsed.requiredIds, ['A', 'B'])
  assert.deepEqual(parsed.emblemIds, ['E', 'E'])
  assert.equal(parsed.traitLadder, false)
  assert.equal(parsed.boardMode, false)
  const many = Array.from({ length: 30 }, (_, i) => `U${i}`).join(',')
  assert.equal(parseBronzeParams(new URLSearchParams(`u=${many}`)).requiredIds.length, 12)
})
