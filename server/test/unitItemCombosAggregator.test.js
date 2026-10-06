import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aggregateUnitItemCombos,
  isValidUnitId,
  MIN_COMBO_GAMES,
} from '../services/unitItemCombosAggregator.js'
import { CURRENT_SET, THIEVES_GLOVES } from '../constants/game.js'

const IE = 'DA_InfinityEdge'
const GS = 'DA_GiantSlayer'
const LW = 'DA_LastWhisper'
const BT = 'DA_Bloodthirster'

function unit(id, itemNames = [], tier = 2) {
  return { character_id: id, tier, itemNames }
}

// Expected per-star buckets: all zero except the levels given.
function unitStars(levels = {}) {
  const zero = { games: 0, placementTotal: 0, wins: 0, top2: 0, threeItemGames: 0 }
  return Object.fromEntries(['1', '2', '3'].map(star => [star, { ...zero, ...levels[star] }]))
}

// Expected star x item-count buckets: all zero except the cells given as
// { star: { itemCount: {...} } }.
function starItems(cells = {}) {
  const zero = { games: 0, placementTotal: 0, wins: 0, top2: 0 }
  return Object.fromEntries(['1', '2', '3'].map(star => [
    star,
    Object.fromEntries(['0', '1', '2', '3'].map(count => [count, { ...zero, ...cells[star]?.[count] }])),
  ]))
}

function comboStars(levels = {}) {
  const zero = { count: 0, placementTotal: 0, wins: 0, top2: 0 }
  return Object.fromEntries(['1', '2', '3'].map(star => [star, { ...zero, ...levels[star] }]))
}

function participant(placement, units) {
  return { puuid: `p${placement}`, placement, partner_group_id: Math.ceil(placement / 2), units, traits: [] }
}

function match(participants, gameType = 'pairs') {
  return {
    tftSetNumber: CURRENT_SET,
    gameDatetime: 1000,
    info: { tft_game_type: gameType, participants },
  }
}

// One match per placement, each with a single board holding `units`.
function boards(placements, units) {
  return placements.map(placement => match([participant(placement, units)]))
}

function rowFor(rows, unitId) {
  return rows.find(row => row.unitId === unitId)
}

describe('aggregateUnitItemCombos', () => {
  it('keeps combos at the 10-game threshold and drops ones below it', () => {
    const rows = aggregateUnitItemCombos([
      ...boards(Array(10).fill(1), [unit('DA_18_Xayah', [IE, GS, LW])]),
      ...boards(Array(9).fill(1), [unit('DA_18_Xayah', [IE, BT, LW])]),
    ])

    assert.equal(MIN_COMBO_GAMES, 10)
    assert.deepEqual(rowFor(rows, 'DA_18_Xayah'), {
      unitId: 'DA_18_Xayah',
      games: 19,
      threeItemGames: 19,
      byStar: unitStars({ 2: { games: 19, placementTotal: 19, wins: 19, top2: 19, threeItemGames: 19 } }),
      byStarItems: starItems({ 2: { 3: { games: 19, placementTotal: 19, wins: 19, top2: 19 } } }),
      combos: [{
        items: [GS, IE, LW],
        count: 10,
        avgPlacement: 1,
        winRate: 1,
        top2Rate: 1,
        frequency: 10 / 19,
        byStar: comboStars({ 2: { count: 10, placementTotal: 10, wins: 10, top2: 10 } }),
      }],
    })
  })

  it('treats item order as irrelevant and computes team-placement metrics', () => {
    // Raw placements 1-8 -> team placements 1,1,2,2,3,3,4,4 (x2 = 16 boards, 2 orderings).
    const placements = [1, 2, 3, 4, 5, 6, 7, 8]
    const rows = aggregateUnitItemCombos([
      ...boards(placements, [unit('DA_18_Xayah', [LW, IE, GS])]),
      ...boards(placements, [unit('DA_18_Xayah', [GS, LW, IE])]),
    ], { minGames: 1 })

    const [combo] = rowFor(rows, 'DA_18_Xayah').combos
    assert.deepEqual(combo, {
      items: [GS, IE, LW],
      count: 16,
      avgPlacement: 2.5,
      winRate: 0.25,
      top2Rate: 0.5,
      frequency: 1,
      byStar: comboStars({ 2: { count: 16, placementTotal: 40, wins: 4, top2: 8 } }),
    })
  })

  it('counts units without a real 3-item build in games but never as a combo', () => {
    const rows = aggregateUnitItemCombos([
      match([
        participant(1, [unit('DA_18_Xayah', [THIEVES_GLOVES])]),
        participant(2, [unit('DA_18_Xayah', [IE, GS, 'TFT_Item_EmptyBag'])]),
        participant(3, [unit('DA_18_Xayah', [IE, GS])]),
        participant(4, [unit('DA_18_Xayah')]),
      ]),
    ], { minGames: 1 })

    assert.deepEqual(rowFor(rows, 'DA_18_Xayah'), {
      unitId: 'DA_18_Xayah',
      games: 4,
      threeItemGames: 0,
      byStar: unitStars({ 2: { games: 4, placementTotal: 6, wins: 2, top2: 4 } }),
      // Thief's Gloves fills 3 slots; EmptyBag isn't an item.
      byStarItems: starItems({ 2: {
        0: { games: 1, placementTotal: 2, wins: 0, top2: 1 },
        2: { games: 2, placementTotal: 3, wins: 1, top2: 2 },
        3: { games: 1, placementTotal: 1, wins: 1, top2: 1 },
      } }),
      combos: [],
    })
  })

  it('does not double count a doubled unit or non-Double Up matches', () => {
    const doubled = [unit('DA_18_Xayah', [IE, GS, LW]), unit('DA_18_Xayah', [LW, GS, IE])]
    const rows = aggregateUnitItemCombos([
      match([participant(1, doubled)]),
      match([participant(1, [unit('DA_18_Xayah', [IE, GS, LW])])], 'standard'),
    ], { minGames: 1 })

    const row = rowFor(rows, 'DA_18_Xayah')
    assert.equal(row.games, 1)
    assert.equal(row.threeItemGames, 1)
    assert.equal(row.combos[0].count, 1)
  })

  it('sorts combos by avg placement, then games played', () => {
    const rows = aggregateUnitItemCombos([
      ...boards([7, 8], [unit('DA_18_Xayah', [BT, BT, IE])]),
      ...boards([1, 2, 3], [unit('DA_18_Xayah', [IE, GS, LW])]),
      ...boards([1, 2], [unit('DA_18_Xayah', [IE, BT, LW])]),
    ], { minGames: 1 })

    assert.deepEqual(
      rowFor(rows, 'DA_18_Xayah').combos.map(combo => combo.items),
      [[BT, IE, LW], [GS, IE, LW], [BT, BT, IE]]
    )
  })
})

describe('aggregateUnitItemCombos star levels', () => {
  it('splits unit and combo totals by star level', () => {
    const rows = aggregateUnitItemCombos([
      ...boards([1, 3], [unit('DA_18_Xayah', [IE, GS, LW], 1)]), // team 1, 2
      ...boards([5], [unit('DA_18_Xayah', [IE, GS, LW], 2)]), // team 3
      ...boards([2, 8], [unit('DA_18_Xayah', [IE, GS, LW], 3)]), // team 1, 4
      ...boards([4], [unit('DA_18_Xayah', [], 3)]), // team 2, no combo
    ], { minGames: 1 })

    const row = rowFor(rows, 'DA_18_Xayah')
    assert.deepEqual(row.byStar, unitStars({
      1: { games: 2, placementTotal: 3, wins: 1, top2: 2, threeItemGames: 2 },
      2: { games: 1, placementTotal: 3, wins: 0, top2: 0, threeItemGames: 1 },
      3: { games: 3, placementTotal: 7, wins: 1, top2: 2, threeItemGames: 2 },
    }))
    assert.deepEqual(row.combos[0].byStar, comboStars({
      1: { count: 2, placementTotal: 3, wins: 1, top2: 2 },
      2: { count: 1, placementTotal: 3, wins: 0, top2: 0 },
      3: { count: 2, placementTotal: 5, wins: 1, top2: 1 },
    }))

    // Per-star buckets always sum to the top-level totals.
    const sum = (byStar, field) => Object.values(byStar).reduce((acc, bucket) => acc + bucket[field], 0)
    assert.equal(sum(row.byStar, 'games'), row.games)
    assert.equal(sum(row.byStar, 'threeItemGames'), row.threeItemGames)
    assert.equal(sum(row.combos[0].byStar, 'count'), row.combos[0].count)
  })

  it('counts a board at its highest copy and clamps out-of-range tiers', () => {
    const rows = aggregateUnitItemCombos([
      match([participant(1, [unit('DA_18_Xayah', [IE, GS, LW], 1), unit('DA_18_Xayah', [BT, BT, IE], 2)])]),
      match([participant(1, [unit('DA_18_Xayah', [], 4)])]),
      match([participant(1, [unit('DA_18_Xayah', [], 0)])]),
      match([participant(1, [{ character_id: 'DA_18_Xayah', itemNames: [] }])]),
    ], { minGames: 1 })

    const row = rowFor(rows, 'DA_18_Xayah')
    assert.equal(row.games, 4)
    assert.equal(row.byStar['1'].games, 2) // tier 0 and missing -> 1
    assert.equal(row.byStar['2'].games, 1) // the 1+2 star board counts once, at 2
    assert.equal(row.byStar['3'].games, 1) // tier 4 -> 3
    // Each combo keeps its own copy's star level.
    const byItems = Object.fromEntries(row.combos.map(combo => [combo.items.join('|'), combo]))
    assert.equal(byItems[[GS, IE, LW].join('|')].byStar['1'].count, 1)
    assert.equal(byItems[[BT, BT, IE].join('|')].byStar['2'].count, 1)
  })
})

describe('aggregateUnitItemCombos item counts', () => {
  it('records each board once at its star level and item count', () => {
    const rows = aggregateUnitItemCombos([
      // Same star: the copy with more items represents the board.
      match([participant(1, [unit('DA_18_Xayah', [IE], 2), unit('DA_18_Xayah', [IE, GS], 2)])]),
      // Higher star wins even with fewer items.
      match([participant(7, [unit('DA_18_Xayah', [IE, GS, LW], 1), unit('DA_18_Xayah', [], 3)])]),
      match([participant(3, [unit('DA_18_Xayah', [BT], 1)])]),
    ], { minGames: 1 })

    const row = rowFor(rows, 'DA_18_Xayah')
    assert.deepEqual(row.byStarItems, starItems({
      1: { 1: { games: 1, placementTotal: 2, wins: 0, top2: 1 } },
      2: { 2: { games: 1, placementTotal: 1, wins: 1, top2: 1 } },
      3: { 0: { games: 1, placementTotal: 4, wins: 0, top2: 0 } },
    }))
    // Each star's item-count cells sum to that star's games.
    for (const star of ['1', '2', '3']) {
      const total = Object.values(row.byStarItems[star]).reduce((sum, cell) => sum + cell.games, 0)
      assert.equal(total, row.byStar[star].games)
    }
  })
})

describe('isValidUnitId', () => {
  it('accepts Riot character ids and rejects anything else', () => {
    assert.equal(isValidUnitId('DA_18_Xayah'), true)
    assert.equal(isValidUnitId('TFT18_Xayah'), true)
    assert.equal(isValidUnitId('bad id'), false)
    assert.equal(isValidUnitId('{"$gt":""}'), false)
    assert.equal(isValidUnitId(''), false)
    assert.equal(isValidUnitId(undefined), false)
  })
})
