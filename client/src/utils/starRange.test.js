// Run with: node --test client/src/utils/starRange.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  combosForStarRange,
  parseStarsParam,
  serializeStarsParam,
  starRangeSummary,
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
