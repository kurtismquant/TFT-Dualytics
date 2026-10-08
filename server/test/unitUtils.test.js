import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canonicalUnitId, deduplicateUnits, hadUnitDoubling } from '../services/unitUtils.js'

function unit(id, itemNames = [], tier = 2) {
  return { character_id: id, tier, itemNames }
}

const ids = units => units.map(u => u.character_id)

describe('canonicalUnitId', () => {
  it('maps alternate Riot ids to the real unit and leaves others alone', () => {
    assert.equal(canonicalUnitId('DA_18_EliseSpider'), 'DA_18_Elise')
    assert.equal(canonicalUnitId('TFT18_NidaleeCougar'), 'DA_Nidalee18_AP')
    assert.equal(canonicalUnitId('TFT18_Akali'), 'DA_18_Akali_AD')
    assert.equal(canonicalUnitId('DA_18_Lux_Inferno'), 'DA_Lux18_Base')
    assert.equal(canonicalUnitId('DA_18_Lux_Moonbeam'), 'DA_Lux18_Base')
    assert.equal(canonicalUnitId('DA_Lux18_Blossom'), 'DA_Lux18_Base')
    assert.equal(canonicalUnitId('DA_18_Ashe'), 'DA_18_Ashe')
  })
})

describe('deduplicateUnits with aliases', () => {
  it('collapses summon clones into the real unit', () => {
    // Real board shape: a 3-star Elise (+2 item-less copies) and 6 spiderlings.
    const board = [
      unit('DA_18_Elise', ['A', 'B', 'C'], 3),
      unit('DA_18_Ivern', ['D', 'E', 'F']),
      unit('DA_18_Elise', [], 3),
      unit('DA_18_Elise', [], 3),
      ...Array.from({ length: 6 }, () => unit('DA_18_EliseSpider', [], 3)),
    ]
    assert.deepEqual(ids(deduplicateUnits(board)), ['DA_18_Elise', 'DA_18_Ivern', 'DA_18_Elise'])

    const lux = [
      unit('DA_Lux18_Base', ['A', 'B', 'C']),
      ...Array.from({ length: 9 }, () => unit('DA_Lux18_Blossom')),
    ]
    const result = deduplicateUnits(lux)
    assert.deepEqual(ids(result), ['DA_Lux18_Base', 'DA_Lux18_Base'])
    assert.deepEqual(result.map(u => u.itemNames.length), [3, 0])
  })

  it('renames a lone alias without dropping anything', () => {
    const board = [unit('TFT18_Akali', ['A', 'B', 'C'], 3), unit('DA_18_Lux_Inferno', ['D', 'E'])]
    const result = deduplicateUnits(board)
    assert.deepEqual(ids(result), ['DA_18_Akali_AD', 'DA_Lux18_Base'])
    assert.equal(result[0].tier, 3)
    assert.deepEqual(result[0].itemNames, ['A', 'B', 'C'])
  })

  it('never mutates the raw match units', () => {
    const board = [unit('TFT18_Akali'), unit('DA_18_EliseSpider'), unit('DA_18_EliseSpider')]
    const snapshot = structuredClone(board)
    deduplicateUnits(board)
    assert.deepEqual(board, snapshot)
  })

  it('keeps hadUnitDoubling on raw ids', () => {
    // A lone form id isn't a duplicate, even though it aliases to a unit present.
    assert.equal(hadUnitDoubling([unit('DA_Lux18_Base'), unit('DA_18_Lux_Inferno')]), false)
    assert.equal(hadUnitDoubling([unit('DA_18_EliseSpider'), unit('DA_18_EliseSpider')]), true)
  })
})
