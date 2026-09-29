// Run with: node --test client/src/utils/itemComboFilter.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildItemCandidates,
  buildItemLookup,
  nextComboSort,
  sortCombos,
  comboMatchesFilters,
  parseItemsParam,
  pickItemMatch,
  rankItemMatches,
  serializeItemsParam,
} from './itemComboFilter.js'

const items = [
  { id: 'DA_InfinityEdge', name: 'Infinity Edge' },
  { id: 'TFT_Item_InfinityEdge', name: 'Infinity Edge' },
  { id: 'DA_Bloodthirster', name: 'Bloodthirster' },
  { id: 'DA_GiantSlayer', name: 'Giant Slayer' },
  { id: 'DA_EdgeOfNight', name: 'Edge of Night' },
  { id: 'DA_Guardbreaker', name: 'Guardbreaker' },
  { id: 'TFT_Item_EmptyBag', name: 'Empty Bag' },
  { id: '9001', apiName: 'TFT_Item_Legacy', name: 'Legacy Relic' },
]

test('comboMatchesFilters requires every filter item, counting duplicates', () => {
  const combo = ['DA_Bloodthirster', 'DA_Bloodthirster', 'DA_InfinityEdge']
  assert.equal(comboMatchesFilters(combo, []), true)
  assert.equal(comboMatchesFilters(combo, ['DA_InfinityEdge']), true)
  assert.equal(comboMatchesFilters(combo, ['DA_Bloodthirster', 'DA_Bloodthirster']), true)
  assert.equal(comboMatchesFilters(combo, ['DA_InfinityEdge', 'DA_GiantSlayer']), false)
  assert.equal(comboMatchesFilters(['DA_Bloodthirster', 'DA_InfinityEdge', 'DA_GiantSlayer'], ['DA_Bloodthirster', 'DA_Bloodthirster']), false)
})

test('buildItemCandidates prefers the id this unit builds for a shared name and drops placeholders', () => {
  const candidates = buildItemCandidates(items, ['DA_InfinityEdge', 'DA_Bloodthirster'])
  const edge = candidates.filter(c => c.name === 'Infinity Edge')
  assert.deepEqual(edge, [{ id: 'DA_InfinityEdge', name: 'Infinity Edge', inCombos: true }])
  assert.equal(candidates.some(c => c.id === 'TFT_Item_EmptyBag'), false)
})

test('rankItemMatches orders exact, prefix, word-start, then substring matches', () => {
  const candidates = buildItemCandidates(items, [])
  assert.deepEqual(
    rankItemMatches('edge', candidates).map(c => c.name),
    ['Edge of Night', 'Infinity Edge']
  )
  assert.deepEqual(rankItemMatches('  ', candidates), [])
  // Substring-only match still resolves.
  assert.equal(pickItemMatch('thirst', candidates)?.id, 'DA_Bloodthirster')
  assert.equal(pickItemMatch('zzz', candidates), null)
})

test('pickItemMatch favors items the unit builds within the same match tier', () => {
  const candidates = buildItemCandidates(items, ['DA_Guardbreaker'])
  assert.equal(pickItemMatch('g', candidates)?.id, 'DA_Guardbreaker')
  assert.equal(pickItemMatch('giant slayer', candidates)?.id, 'DA_GiantSlayer')
})

test('items param round-trips and caps at 3', () => {
  assert.deepEqual(parseItemsParam('a,b,,c,d'), ['a', 'b', 'c'])
  assert.deepEqual(parseItemsParam(null), [])
  assert.equal(serializeItemsParam(['a', 'b']), 'a,b')
})

test('candidates and lookup key items by apiName, the id match docs store', () => {
  const candidates = buildItemCandidates(items, ['TFT_Item_Legacy'])
  assert.deepEqual(pickItemMatch('legacy', candidates), { id: 'TFT_Item_Legacy', name: 'Legacy Relic', inCombos: true })
  const lookup = buildItemLookup(items)
  assert.equal(lookup.get('TFT_Item_Legacy')?.name, 'Legacy Relic')
  assert.equal(lookup.get('9001')?.name, 'Legacy Relic')
})

test('sortCombos sorts by the chosen column and breaks ties by games', () => {
  const combos = [
    { items: ['a'], count: 10, avgPlacement: 2.0, winRate: 0.3 },
    { items: ['b'], count: 50, avgPlacement: 2.0, winRate: 0.2 },
    { items: ['c'], count: 20, avgPlacement: 1.5, winRate: 0.4 },
  ]
  assert.deepEqual(sortCombos(combos, { key: 'avgPlacement', direction: 'asc' }).map(c => c.items[0]), ['c', 'b', 'a'])
  assert.deepEqual(sortCombos(combos, { key: 'winRate', direction: 'desc' }).map(c => c.items[0]), ['c', 'a', 'b'])
  assert.deepEqual(nextComboSort({ key: 'avgPlacement', direction: 'asc' }, 'count'), { key: 'count', direction: 'desc' })
  assert.deepEqual(nextComboSort({ key: 'count', direction: 'desc' }, 'count'), { key: 'count', direction: 'asc' })
})
