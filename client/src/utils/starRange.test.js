// Run with: node --test client/src/utils/starRange.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  combosForStarRange,
  itemsForRange,
  parseItemCountParam,
  parseStarsParam,
  serializeItemCountParam,
  serializeStarsParam,
  starRangeSummary,
  unitRangeSummary,
} from './starRange.js'

const unitByStar = {
  1: { games: 10, placementTotal: 30, wins: 1, top2: 3, threeItemGames: 4 },
  2: { games: 20, placementTotal: 44, wins: 5, top2: 10, threeItemGames: 16 },
  3: { games: 10, placementTotal: 16, wins: 4, top2: 8, threeItemGames: 10 },
}

function combo(items, byStar) {
  const count = Object.values(byStar).reduce((sum, b) => sum + b.count, 0)
  return { items, count, avgPlacement: 0, winRate: 0, top2Rate: 0, frequency: 0, byStar }
}

test('parseStarsParam accepts ranges and single levels, and repairs bad input', () => {
  assert.deepEqual(parseStarsParam('2-3'), { min: 2, max: 3 })
  assert.deepEqual(parseStarsParam('3-1'), { min: 1, max: 3 })
  assert.deepEqual(parseStarsParam('2'), { min: 2, max: 2 })
  assert.deepEqual(parseStarsParam('0-9'), { min: 1, max: 3 })
  assert.deepEqual(parseStarsParam(null), { min: 1, max: 3 })
  assert.deepEqual(parseStarsParam('abc'), { min: 1, max: 3 })
})

test('serializeStarsParam omits the full range', () => {
  assert.equal(serializeStarsParam({ min: 1, max: 3 }), null)
  assert.equal(serializeStarsParam({ min: 2, max: 3 }), '2-3')
  assert.equal(serializeStarsParam({ min: 3, max: 3 }), '3')
})

test('starRangeSummary sums only the levels in range', () => {
  assert.deepEqual(starRangeSummary(unitByStar, { min: 2, max: 3 }), {
    games: 30,
    threeItemGames: 26,
    avgPlacement: 2,
    winRate: 0.3,
    top2Rate: 0.6,
  })
  assert.deepEqual(starRangeSummary({ ...unitByStar, 3: { games: 0 } }, { min: 3, max: 3 }), {
    games: 0,
    threeItemGames: 0,
    avgPlacement: null,
    winRate: null,
    top2Rate: null,
  })
})

test('combosForStarRange re-scores combos within the range and applies minGames there', () => {
  const combos = [
    combo(['a'], {
      1: { count: 4, placementTotal: 16, wins: 0, top2: 0 },
      2: { count: 6, placementTotal: 12, wins: 2, top2: 4 },
      3: { count: 4, placementTotal: 4, wins: 4, top2: 4 },
    }),
    combo(['b'], {
      1: { count: 0, placementTotal: 0, wins: 0, top2: 0 },
      2: { count: 10, placementTotal: 25, wins: 1, top2: 4 },
      3: { count: 1, placementTotal: 1, wins: 1, top2: 1 },
    }),
  ]

  const ranged = combosForStarRange(combos, unitByStar, { min: 2, max: 3 }, 10)
  assert.deepEqual(ranged.map(c => [c.items[0], c.count, c.avgPlacement, c.winRate, c.top2Rate, c.frequency]), [
    ['a', 10, 1.6, 0.6, 0.8, 10 / 26],
    ['b', 11, 26 / 11, 2 / 11, 5 / 11, 11 / 26],
  ])
  // Only 4 3-star games for 'a' and 1 for 'b' -> both below 10.
  assert.deepEqual(combosForStarRange(combos, unitByStar, { min: 3, max: 3 }, 10), [])
})

test('combosForStarRange leaves combos alone for the full range or legacy docs', () => {
  const combos = [{ items: ['a'], count: 12 }]
  assert.equal(combosForStarRange(combos, unitByStar, { min: 1, max: 3 }, 10), combos)
  assert.equal(combosForStarRange(combos, null, { min: 2, max: 2 }, 10), combos)
})

test('item count params cover 0-3 and omit the full range', () => {
  assert.deepEqual(parseItemCountParam('0-2'), { min: 0, max: 2 })
  assert.deepEqual(parseItemCountParam('3'), { min: 3, max: 3 })
  assert.deepEqual(parseItemCountParam(''), { min: 0, max: 3 })
  assert.equal(serializeItemCountParam({ min: 0, max: 3 }), null)
  assert.equal(serializeItemCountParam({ min: 0, max: 0 }), '0')
})

test('unitRangeSummary sums star x item-count cells inside both ranges', () => {
  const cell = (games, placementTotal, wins, top2) => ({ games, placementTotal, wins, top2 })
  const empty = cell(0, 0, 0, 0)
  const byStarItems = {
    1: { 0: cell(4, 14, 0, 0), 1: empty, 2: cell(2, 6, 0, 1), 3: cell(4, 10, 1, 2) },
    2: { 0: cell(2, 8, 0, 0), 1: cell(2, 6, 0, 1), 2: cell(6, 14, 1, 3), 3: cell(10, 16, 4, 6) },
    3: { 0: empty, 1: empty, 2: empty, 3: cell(10, 16, 4, 8) },
  }
  const unit = { byStar: unitByStar, byStarItems }

  // 2-3 star holding 2-3 items: cells (2,2), (2,3), (3,3).
  assert.deepEqual(unitRangeSummary(unit, { min: 2, max: 3 }, { min: 2, max: 3 }), {
    games: 26,
    threeItemGames: 26,
    avgPlacement: 46 / 26,
    winRate: 9 / 26,
    top2Rate: 17 / 26,
  })
  // Item range without 3 -> no 3-item builds.
  assert.equal(unitRangeSummary(unit, { min: 1, max: 3 }, { min: 0, max: 1 }).threeItemGames, 0)
  assert.equal(unitRangeSummary(unit, { min: 1, max: 3 }, { min: 0, max: 1 }).games, 8)
  // Legacy docs without byStarItems ignore the item range.
  assert.deepEqual(
    unitRangeSummary({ byStar: unitByStar }, { min: 2, max: 3 }, { min: 0, max: 0 }),
    starRangeSummary(unitByStar, { min: 2, max: 3 })
  )
})

test('itemsForRange sums the star x items-held cells and applies the games floor', () => {
  const cell = (games, placementTotal, wins, top2) => ({ games, placementTotal, wins, top2 })
  const ie = {
    items: ['IE'],
    byStarItems: {
      2: { 2: cell(6, 12, 2, 4), 3: cell(10, 20, 3, 6) },
      3: { 3: cell(4, 4, 4, 4) },
    },
  }
  const rare = { items: ['GS'], byStarItems: { 2: { 3: cell(3, 6, 1, 2) } } }

  assert.deepEqual(itemsForRange([ie, rare], { min: 1, max: 3 }, { min: 0, max: 3 }, 10, 40), [
    { items: ['IE'], count: 20, avgPlacement: 36 / 20, winRate: 9 / 20, top2Rate: 14 / 20, frequency: 0.5 },
  ])
  // 3 star only, 3 items only: 4 boards, below the floor of 5.
  assert.deepEqual(itemsForRange([ie], { min: 3, max: 3 }, { min: 3, max: 3 }, 5, 4), [])
  assert.deepEqual(itemsForRange([ie], { min: 2, max: 2 }, { min: 3, max: 3 }, 5, 10).map(r => r.count), [10])
  assert.deepEqual(itemsForRange(null, { min: 1, max: 3 }, { min: 0, max: 3 }, 1, 0), [])
})
