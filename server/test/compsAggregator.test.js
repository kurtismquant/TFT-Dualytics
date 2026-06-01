import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aggregateComps,
  buildCompAggregationMatchFilter,
} from '../services/compsAggregator.js'
import { CURRENT_SET } from '../constants/game.js'

const THIEVES_GLOVES = 'TFT_Item_ThievesGloves'

function unit(id, overrides = {}) {
  return {
    character_id: id,
    tier: 2,
    itemNames: [],
    ...overrides,
  }
}

function participant(overrides = {}) {
  return {
    puuid: 'puuid',
    partner_group_id: 1,
    placement: 1,
    units: [],
    traits: [],
    ...overrides,
  }
}

function match(participants, overrides = {}) {
  return {
    tftSetNumber: CURRENT_SET,
    gameDatetime: 1000,
    info: {
      tft_game_type: 'pairs',
      game_version: 'Version 17.2.614.1234',
      participants,
      ...overrides.info,
    },
    ...overrides,
  }
}

function findComp(results, unitIds) {
  const fingerprint = unitIds.slice().sort().join('|')
  return results.find(comp => comp.fingerprint === fingerprint)
}

function units(unitIds, overridesById = {}) {
  return unitIds.map(id => unit(id, overridesById[id]))
}

describe('aggregateComps', () => {
  it('aggregates repeated comps with Double Up team placement, win rate, traits, and partners', () => {
    const alphaUnits = [unit('TFT17_ALPHA'), unit('TFT17_BRAVO')]
    const betaUnits = [unit('TFT17_CHARLIE'), unit('TFT17_DELTA')]
    const gammaUnits = [unit('TFT17_ECHO'), unit('TFT17_FOXTROT')]

    const results = aggregateComps([
      match([
        participant({
          puuid: 'alpha-1',
          partner_group_id: 10,
          placement: 1,
          units: alphaUnits,
          traits: [
            { name: 'TFT17_ACTIVE', num_units: 2, tier_current: 1, style: 1 },
            { name: 'TFT17_INACTIVE', num_units: 1, tier_current: 0, style: 0 },
          ],
        }),
        participant({
          puuid: 'beta-1',
          partner_group_id: 10,
          placement: 2,
          units: betaUnits,
        }),
        participant({
          puuid: 'gamma-1',
          partner_group_id: 20,
          placement: 3,
          units: gammaUnits,
        }),
      ]),
      match([
        participant({
          puuid: 'alpha-2',
          partner_group_id: 30,
          placement: 5,
          units: alphaUnits,
        }),
        participant({
          puuid: 'gamma-2',
          partner_group_id: 30,
          placement: 6,
          units: gammaUnits,
        }),
      ]),
    ])

    const alpha = findComp(results, ['TFT17_ALPHA', 'TFT17_BRAVO'])

    assert.equal(alpha.playCount, 2)
    assert.equal(alpha.avgPlacement, 2)
    assert.equal(alpha.winRate, 0.5)
    assert.deepEqual(alpha.units.map(u => u.id), ['TFT17_ALPHA', 'TFT17_BRAVO'])
    assert.deepEqual(alpha.traits, [
      { id: 'TFT17_ACTIVE', numUnits: 2, tierCurrent: 1, style: 1 },
    ])
    assert.deepEqual(alpha.topPartners.map(p => p.fingerprint), [
      'TFT17_CHARLIE|TFT17_DELTA',
      'TFT17_ECHO|TFT17_FOXTROT',
    ])
    assert.equal(alpha.topPartners[0].pairCount, 1)
    assert.equal(alpha.topPartners[0].avgPlacement, 1)
    assert.equal(alpha.topPartners[0].winRate, 1)
  })

  it('normalizes duplicate unit observations, three-star flags, sorted item combos, and Thieves Gloves', () => {
    const carryItems = ['TFT_Item_Zeke', 'TFT_Item_ArchangelsStaff', 'TFT_Item_MadredsBloodrazor']
    const fillerUnits = Array.from({ length: 12 }, (_, index) => unit(`TFT17_FILLER_${index + 1}`))
    const noisyUnits = [
      unit('TFT17_CARRY', { tier: 3, itemNames: carryItems }),
      unit('TFT17_SUPPORT', { itemNames: [THIEVES_GLOVES] }),
      ...fillerUnits,
      unit('TFT17_CARRY', { tier: 3, itemNames: carryItems }),
    ]

    const results = aggregateComps([
      match([participant({ puuid: 'items-1', placement: 1, units: noisyUnits })]),
      match([participant({ puuid: 'items-2', placement: 2, units: noisyUnits })]),
    ])

    const comp = results[0]
    const carry = comp.units.find(u => u.id === 'TFT17_CARRY')
    const support = comp.units.find(u => u.id === 'TFT17_SUPPORT')

    assert.equal(comp.playCount, 2)
    assert.equal(comp.units.length, 14)
    assert.equal(comp.units.filter(u => u.id === 'TFT17_CARRY').length, 1)
    assert.equal(carry.tier, 3)
    assert.deepEqual(carry.items, carryItems.slice().sort())
    assert.deepEqual(support.items, [THIEVES_GLOVES])
  })

  it('merges similar comps into the original best comp while preserving units, traits, stars, and absorbing items and partners', () => {
    const mainIds = [
      'TFT17_MAIN_1',
      'TFT17_MAIN_2',
      'TFT17_MAIN_3',
      'TFT17_MAIN_4',
      'TFT17_MAIN_5',
      'TFT17_MAIN_6',
      'TFT17_MAIN_7',
    ]
    const variantIds = [
      'TFT17_MAIN_1',
      'TFT17_MAIN_2',
      'TFT17_MAIN_3',
      'TFT17_MAIN_4',
      'TFT17_MAIN_5',
      'TFT17_MAIN_6',
      'TFT17_VARIANT_1',
    ]
    const chainedIds = [
      'TFT17_MAIN_1',
      'TFT17_MAIN_2',
      'TFT17_MAIN_3',
      'TFT17_MAIN_4',
      'TFT17_MAIN_5',
      'TFT17_VARIANT_1',
      'TFT17_VARIANT_2',
    ]
    const partnerIds = [
      'TFT17_PARTNER_1',
      'TFT17_PARTNER_2',
      'TFT17_PARTNER_3',
      'TFT17_PARTNER_4',
      'TFT17_PARTNER_5',
      'TFT17_PARTNER_6',
      'TFT17_PARTNER_7',
    ]
    const partnerVariantIds = [
      'TFT17_PARTNER_1',
      'TFT17_PARTNER_2',
      'TFT17_PARTNER_3',
      'TFT17_PARTNER_4',
      'TFT17_PARTNER_5',
      'TFT17_PARTNER_6',
      'TFT17_PARTNER_VARIANT_1',
    ]
    const carryItems = ['TFT_Item_Zeke', 'TFT_Item_ArchangelsStaff', 'TFT_Item_MadredsBloodrazor']
    let gameIndex = 0

    const pairedMatch = ({ placement, compUnits, partnerUnits = units(partnerIds) }) => {
      gameIndex += 1
      return match([
        participant({
          puuid: `comp-${gameIndex}`,
          partner_group_id: gameIndex,
          placement,
          units: compUnits,
          traits: [{ name: 'TFT17_CANONICAL', num_units: 7, tier_current: 2, style: 2 }],
        }),
        participant({
          puuid: `partner-${gameIndex}`,
          partner_group_id: gameIndex,
          placement: placement + 1,
          units: partnerUnits,
        }),
      ])
    }

    const results = aggregateComps([
      pairedMatch({
        placement: 1,
        compUnits: units(mainIds, { TFT17_MAIN_2: { tier: 3 } }),
      }),
      pairedMatch({
        placement: 3,
        compUnits: units(mainIds, { TFT17_MAIN_2: { tier: 3 } }),
      }),
      pairedMatch({
        placement: 3,
        compUnits: units(mainIds),
      }),
      pairedMatch({
        placement: 5,
        compUnits: units(variantIds, { TFT17_MAIN_1: { itemNames: carryItems } }),
        partnerUnits: units(partnerVariantIds, { TFT17_PARTNER_1: { itemNames: carryItems } }),
      }),
      pairedMatch({
        placement: 7,
        compUnits: units(variantIds, { TFT17_MAIN_1: { itemNames: carryItems } }),
        partnerUnits: units(partnerVariantIds, { TFT17_PARTNER_1: { itemNames: carryItems } }),
      }),
      pairedMatch({
        placement: 7,
        compUnits: units(variantIds, { TFT17_MAIN_1: { itemNames: carryItems } }),
        partnerUnits: units(partnerVariantIds, { TFT17_PARTNER_1: { itemNames: carryItems } }),
      }),
      pairedMatch({
        placement: 1,
        compUnits: units(chainedIds),
      }),
    ])

    const main = findComp(results, mainIds)
    const variant = findComp(results, variantIds)
    const chained = findComp(results, chainedIds)
    const mainCarry = main.units.find(u => u.id === 'TFT17_MAIN_1')
    const mainStar = main.units.find(u => u.id === 'TFT17_MAIN_2')
    const topPartner = main.topPartners[0]
    const partnerCarry = topPartner.units.find(u => u.id === 'TFT17_PARTNER_1')

    assert.equal(main.playCount, 6)
    assert.equal(main.avgPlacement, 16 / 6)
    assert.equal(main.winRate, 1 / 6)
    assert.deepEqual(main.units.map(u => u.id), mainIds)
    assert.deepEqual(main.traits, [
      { id: 'TFT17_CANONICAL', numUnits: 7, tierCurrent: 2, style: 2 },
    ])
    assert.deepEqual(mainCarry.items, carryItems.slice().sort())
    assert.equal(mainStar.tier, 3)
    assert.equal(variant, undefined)
    assert.equal(chained.playCount, 1)
    assert.equal(topPartner.fingerprint, partnerIds.slice().sort().join('|'))
    assert.equal(topPartner.pairCount, 6)
    assert.deepEqual(topPartner.units.map(u => u.id), partnerIds)
    assert.deepEqual(partnerCarry.items, carryItems.slice().sort())
    assert.equal(main.topPartners.some(p => p.fingerprint === partnerVariantIds.slice().sort().join('|')), false)
  })

  it('returns an empty result for empty input, non-Double-Up matches, and participants without comps', () => {
    assert.deepEqual(aggregateComps([]), [])
    assert.deepEqual(aggregateComps([match([], { info: { tft_game_type: 'standard' } })]), [])
    assert.deepEqual(aggregateComps([{}]), [])
    assert.deepEqual(aggregateComps([match()]), [])
    assert.deepEqual(aggregateComps([match([participant({ units: undefined })])]), [])
  })
})

describe('buildCompAggregationMatchFilter', () => {
  it('restricts aggregation reads to current-set Double Up matches', () => {
    assert.deepEqual(buildCompAggregationMatchFilter(), {
      'info.tft_game_type': 'pairs',
      tftSetNumber: CURRENT_SET,
    })
  })

  it('converts the TFT patch label to a LoL game_version regex when a patch is known', () => {
    // TFT 17.2 = LoL 16.9, so the raw game_version filter targets "16.9".
    assert.deepEqual(buildCompAggregationMatchFilter('17.2'), {
      'info.tft_game_type': 'pairs',
      tftSetNumber: CURRENT_SET,
      'info.game_version': { $regex: '\\b16\\.9\\.' },
    })
  })
})
