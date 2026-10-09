// Run with: node --test client/src/utils/explorerSort.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { compareExplorerRows, DEFAULT_EXPLORER_SORT, nextExplorerSort } from './explorerSort.js'

const rows = [
  { id: 'a', count: 10, avgPlacement: 2.5, winRate: 0.2, delta: 0.1 },
  { id: 'b', count: 30, avgPlacement: 2.4, winRate: 0.3, delta: -0.1 },
  { id: 'c', count: 20, avgPlacement: 2.4, winRate: 0.1, delta: -0.1 },
]
const order = sort => rows.slice().sort((x, y) => compareExplorerRows(x, y, sort)).map(r => r.id)

test('sorts by any column, ties falling back to most played', () => {
  assert.deepEqual(order(DEFAULT_EXPLORER_SORT), ['b', 'c', 'a'])
  assert.deepEqual(order({ key: 'avgPlacement', direction: 'asc' }), ['b', 'c', 'a'])
  assert.deepEqual(order({ key: 'winRate', direction: 'desc' }), ['b', 'a', 'c'])
  assert.deepEqual(order({ key: 'delta', direction: 'desc' }), ['a', 'b', 'c'])
})

test('a new column starts in its default direction; the active one flips', () => {
  assert.deepEqual(nextExplorerSort(DEFAULT_EXPLORER_SORT, 'avgPlacement'), { key: 'avgPlacement', direction: 'asc' })
  assert.deepEqual(nextExplorerSort(DEFAULT_EXPLORER_SORT, 'count'), { key: 'count', direction: 'asc' })
})
