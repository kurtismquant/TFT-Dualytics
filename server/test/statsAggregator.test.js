import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aggregateStats,
  buildStatsMatchFilter,
  patchForTimestamp,
  patchToNum,
} from '../services/statsAggregator.js'
import { patchWindow } from '../services/patchFilters.js'
import { CURRENT_SET } from '../constants/game.js'

function unit(id, itemNames = []) {
  return { character_id: id, tier: 2, itemNames }
}

function participant(overrides = {}) {
  return {
    placement: 1,
    units: [],
    traits: [],
    ...overrides,
  }
}

function match(participants, overrides = {}) {
  return {
    tftSetNumber: CURRENT_SET,
    info: {
      tft_game_type: 'pairs',
      game_version: 'TFT Unreal Version ?.?.?.?',
      participants,
      ...overrides.info,
    },
    ...overrides,
  }
}

describe('aggregateStats', () => {
  it('aggregates unit stats with average placement, win rate, frequency, and popular items', () => {
    const results = aggregateStats([
      match([
        participant({
          placement: 1,
          units: [unit('DA_18_ALPHA', ['DA_ItemA', 'DA_ItemB']), unit('DA_18_BRAVO')],
        }),
        participant({
          placement: 6,
          units: [unit('DA_18_ALPHA', ['DA_ItemA'])],
        }),
      ]),
    ], 'units')

    const alpha = results.rows.find(row => row.id === 'DA_18_ALPHA')

    assert.equal(results.matchCount, 1)
    assert.equal(results.participantCount, 2)
    assert.equal(alpha.count, 2)
    assert.equal(alpha.avgPlacement, 2)
    assert.equal(alpha.winRate, 0.5)
    assert.equal(alpha.frequency, 1)
    assert.deepEqual(alpha.popularItems, [
      { id: 'DA_ItemA', count: 2 },
      { id: 'DA_ItemB', count: 1 },
    ])
  })

  it('aggregates item and trait stats with popular units', () => {
    const docs = [
      match([
        participant({
          placement: 2,
          units: [unit('DA_18_ALPHA', ['DA_ItemA']), unit('DA_18_BRAVO', ['DA_ItemA'])],
          traits: [{ name: 'DA_18_TRAIT', num_units: 2, tier_current: 1 }],
        }),
        participant({
          placement: 7,
          units: [unit('DA_18_ALPHA', ['DA_ItemB'])],
          traits: [{ name: 'DA_18_TRAIT', num_units: 1, tier_current: 0 }],
        }),
      ]),
    ]

    const itemStats = aggregateStats(docs, 'items')
    const traitStats = aggregateStats(docs, 'traits')
    const itemA = itemStats.rows.find(row => row.id === 'DA_ItemA')
    const trait = traitStats.rows.find(row => row.id === 'DA_18_TRAIT#1')

    assert.equal(itemStats.itemCount, 3)
    assert.equal(itemA.count, 2)
    assert.equal(itemA.winRate, 1)
    assert.deepEqual(itemA.popularUnits, [
      { id: 'DA_18_ALPHA', count: 1 },
      { id: 'DA_18_BRAVO', count: 1 },
    ])
    assert.equal(trait.count, 1)
    assert.equal(trait.tier, 1)
    assert.equal(trait.traitId, 'DA_18_TRAIT')
    assert.equal(trait.avgUnits, 2)
    assert.deepEqual(trait.popularUnits, [
      { id: 'DA_18_ALPHA', count: 1 },
      { id: 'DA_18_BRAVO', count: 1 },
    ])
  })
})

describe('stats patch helpers', () => {
  const schedule = [
    { patch: '18.1', startsAt: Date.UTC(2026, 7, 26) },
    { patch: '18.2', startsAt: Date.UTC(2026, 8, 9) },
  ]

  it('assigns a TFT patch label from game_datetime via the schedule', () => {
    assert.equal(patchForTimestamp(Date.UTC(2026, 7, 25, 23), schedule), null) // previous set
    assert.equal(patchForTimestamp(Date.UTC(2026, 7, 26), schedule), '18.1') // inclusive start
    assert.equal(patchForTimestamp(Date.UTC(2026, 8, 8, 23, 59), schedule), '18.1')
    assert.equal(patchForTimestamp(Date.UTC(2026, 8, 9), schedule), '18.2')
    assert.equal(patchForTimestamp(Date.UTC(2027, 0, 1), schedule), '18.2') // newest patch is open-ended
    assert.equal(patchForTimestamp(undefined, schedule), null)
    assert.equal(patchToNum('18.2'), 1802)
  })

  it('resolves patch windows with an open end for the newest patch', () => {
    assert.deepEqual(patchWindow('18.1', schedule), { start: Date.UTC(2026, 7, 26), end: Date.UTC(2026, 8, 9) })
    assert.deepEqual(patchWindow('18.2', schedule), { start: Date.UTC(2026, 8, 9), end: null })
    assert.equal(patchWindow('17.4', schedule), null)
  })

  it('builds a gameDatetime-window DB filter for the configured first patch', () => {
    const filter = buildStatsMatchFilter('18.1')
    assert.equal(filter['info.tft_game_type'], 'pairs')
    assert.equal(filter.tftSetNumber, CURRENT_SET)
    assert.equal(filter.gameDatetime.$gte, Date.UTC(2026, 7, 26))
    // Unknown labels fall back to the whole set rather than an empty result.
    assert.deepEqual(buildStatsMatchFilter('17.2'), { 'info.tft_game_type': 'pairs', tftSetNumber: CURRENT_SET })
  })
})
