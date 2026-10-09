import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_ITEM_UNIT_SORT, nextItemUnitSort, sortItemUnits } from './itemUnitSort.js'

const rows = [
  { unitId: 'B', count: 20, avgPlacement: 2.1, delta: 0.2, winRate: 0.3 },
  { unitId: 'A', count: 40, avgPlacement: 1.8, delta: -0.4, winRate: 0.4 },
  { unitId: 'C', count: 40, avgPlacement: 2.1, delta: -0.1, winRate: 0.2 },
]

describe('sortItemUnits', () => {
  it('sorts by avg placement ascending by default, ties to more games', () => {
    assert.deepEqual(sortItemUnits(rows, DEFAULT_ITEM_UNIT_SORT).map(r => r.unitId), ['A', 'C', 'B'])
  })

  it('sorts by delta and flips direction', () => {
    const sort = nextItemUnitSort(DEFAULT_ITEM_UNIT_SORT, 'delta')
    assert.deepEqual(sort, { key: 'delta', direction: 'asc' })
    assert.deepEqual(sortItemUnits(rows, sort).map(r => r.unitId), ['A', 'C', 'B'])
    assert.deepEqual(sortItemUnits(rows, nextItemUnitSort(sort, 'delta')).map(r => r.unitId), ['B', 'C', 'A'])
  })

  it('descends rates and counts on first click', () => {
    assert.deepEqual(nextItemUnitSort(DEFAULT_ITEM_UNIT_SORT, 'winRate'), { key: 'winRate', direction: 'desc' })
    assert.deepEqual(sortItemUnits(rows, { key: 'count', direction: 'desc' }).map(r => r.unitId), ['A', 'C', 'B'])
  })
})
