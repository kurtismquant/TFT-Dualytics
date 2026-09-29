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

function unit(id, itemNames = []) {
  return { character_id: id, tier: 2, itemNames }
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
      combos: [{
        items: [GS, IE, LW],
        count: 10,
        avgPlacement: 1,
        winRate: 1,
        top2Rate: 1,
        frequency: 10 / 19,
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
