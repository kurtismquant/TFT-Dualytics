import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { aggregateItemUnits, isValidItemId } from '../services/itemUnitsAggregator.js'
import { MIN_COMBO_GAMES } from '../services/unitItemCombosAggregator.js'
import { CURRENT_SET } from '../constants/game.js'

const IE = 'DA_InfinityEdge'
const GS = 'DA_GiantSlayer'
const XAYAH = 'DA_18_Xayah'
const AHRI = 'DA_18_Ahri'

function unit(id, itemNames = [], tier = 2) {
  return { character_id: id, tier, itemNames }
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

function itemRow(rows, itemId) {
  return rows.find(row => row.itemId === itemId)
}

describe('aggregateItemUnits', () => {
  it('builds per-unit rows with share, build rate and delta vs the unit average', () => {
    const rows = aggregateItemUnits([
      // Xayah: 10 boards with IE at team 1st, 10 itemless boards at team 4th.
      ...boards(Array(10).fill(1), [unit(XAYAH, [IE])]),
      ...boards(Array(10).fill(7), [unit(XAYAH, [])]),
      // Ahri: 9 IE boards, below the floor, but still counted toward IE's total.
      ...boards(Array(9).fill(3), [unit(AHRI, [IE])]),
    ])

    assert.equal(MIN_COMBO_GAMES, 10)
    assert.deepEqual(itemRow(rows, IE), {
      itemId: IE,
      games: 19,
      // Overall: 10 boards at team 1st + Ahri's 9 at team 2nd.
      avgPlacement: 28 / 19,
      winRate: 10 / 19,
      top2Rate: 1,
      units: [{
        unitId: XAYAH,
        count: 10,
        avgPlacement: 1,
        winRate: 1,
        top2Rate: 1,
        buildRate: 0.5,
        unitAvgPlacement: 2.5,
        delta: -1.5,
        share: 10 / 19,
      }],
    })
  })

  it('uses team placement and sorts units by avg placement, then games', () => {
    // Raw 1-8 -> team 1,1,2,2,3,3,4,4: avg 2.5, win 2/8, top 2 4/8.
    const placements = [1, 2, 3, 4, 5, 6, 7, 8]
    const rows = aggregateItemUnits([
      ...boards([...placements, ...placements], [unit(AHRI, [GS])]),
      ...boards(Array(10).fill(2), [unit(XAYAH, [GS])]),
    ])

    const { games, units } = itemRow(rows, GS)
    assert.equal(games, 26)
    assert.deepEqual(units.map(u => [u.unitId, u.count, u.avgPlacement, u.winRate, u.top2Rate]), [
      [XAYAH, 10, 1, 1, 1],
      [AHRI, 16, 2.5, 4 / 16, 8 / 16],
    ])
    // Every board of each unit held GS, so the item can't beat the unit's own average.
    assert.deepEqual(units.map(u => [u.buildRate, u.delta]), [[1, 0], [1, 0]])
  })

  it('counts an item once per board when two copies of the unit hold it', () => {
    const rows = aggregateItemUnits(
      boards(Array(10).fill(1), [unit(XAYAH, [IE]), unit(XAYAH, [IE, GS], 1)])
    )
    const [xayah] = itemRow(rows, IE).units
    assert.equal(itemRow(rows, IE).games, 10)
    assert.equal(xayah.count, 10)
    assert.equal(xayah.buildRate, 1)
  })

  it('skips the EmptyBag placeholder and non-Double Up games', () => {
    const rows = aggregateItemUnits([
      ...boards(Array(10).fill(1), [unit(XAYAH, ['TFT_Item_EmptyBag'])]),
      ...Array(10).fill(match([participant(1, [unit(AHRI, [IE])])], 'standard')),
    ])
    assert.deepEqual(rows, [])
  })
})

describe('isValidItemId', () => {
  it('accepts apiNames and rejects anything that could be an operator or path', () => {
    assert.equal(isValidItemId('TFT_Item_InfinityEdge'), true)
    assert.equal(isValidItemId('$where'), false)
    assert.equal(isValidItemId('../x'), false)
    assert.equal(isValidItemId(''), false)
  })
})
