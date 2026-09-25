import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeRiotMatch } from '../services/riotMatchCompat.js'
import { normalizeMatch } from '../services/matchNormalizers.js'
import { aggregateComps } from '../services/compsAggregator.js'

// Trimmed from a real Set 18 ranked Double Up match (NA, Sep 2026): queue 1160,
// tft_game_type "standard", no partner_group_id, no usable game_version.
function set18DoubleUpMatch() {
  return {
    metadata: { match_id: 'NA1_5647973111' },
    info: {
      queue_id: 1160,
      tft_game_type: 'standard',
      tft_set_number: 18,
      game_datetime: Date.UTC(2026, 8, 24, 5, 54),
      game_version: 'TFT Unreal Version ?.?.?.?',
      participants: [
        { puuid: 'p1', placement: 1, units: [{ character_id: 'DA_Cinderling18', tier: 2, itemNames: [] }, { character_id: 'DA_18_Sentry', tier: 2, itemNames: [] }, { character_id: 'DA_Krug18', tier: 3, itemNames: ['DA_GargoyleStoneplate', 'DA_WarmogsArmor', 'DA_SteadfastHeart'] }], traits: [{ name: 'DA_18_Hunter', num_units: 2, tier_current: 1, style: 1 }] },
        { puuid: 'p2', placement: 2, units: [{ character_id: 'DA_18_Rakan', tier: 2, itemNames: [] }, { character_id: 'DA_18_Sejuani', tier: 2, itemNames: [] }], traits: [{ name: 'DA_18_Inferno', num_units: 2, tier_current: 1, style: 1 }] },
        { puuid: 'p3', placement: 3, units: [{ character_id: 'DA_18_Leona', tier: 3, itemNames: ['DA_ThiefsGloves', 'DA_GiantSlayer', 'DA_GuinsoosRageblade'] }, { character_id: 'DA_18_Camille', tier: 3, itemNames: ['DA_InfinityEdge'] }], traits: [{ name: 'DA_18_Defender', num_units: 2, tier_current: 1, style: 1 }] },
        { puuid: 'p4', placement: 4, units: [{ character_id: 'DA_Karma18', tier: 2, itemNames: [] }, { character_id: 'DA_Krug18', tier: 2, itemNames: [] }], traits: [{ name: 'DA_18_Blossom', num_units: 5, tier_current: 2, style: 2 }] },
      ],
    },
  }
}

describe('normalizeRiotMatch', () => {
  it('restores the Double Up shape for Set 18 queue-1160 matches', () => {
    const normalized = normalizeRiotMatch(set18DoubleUpMatch())
    assert.equal(normalized.info.tft_game_type, 'pairs')
    // Partners share team placement: 1&2 → group 1, 3&4 → group 2.
    assert.deepEqual(normalized.info.participants.map(p => p.partner_group_id), [1, 1, 2, 2])
  })

  it('keeps an existing partner_group_id and leaves non-Double-Up matches untouched', () => {
    const withGroup = set18DoubleUpMatch()
    withGroup.info.participants[0].partner_group_id = 7
    assert.equal(normalizeRiotMatch(withGroup).info.participants[0].partner_group_id, 7)

    const ranked = set18DoubleUpMatch()
    ranked.info.queue_id = 1100
    assert.equal(normalizeRiotMatch(ranked), ranked)
    assert.equal(normalizeRiotMatch(null), null)
  })

  it('feeds the normalizer and comp aggregator end to end', () => {
    const normalized = normalizeRiotMatch(set18DoubleUpMatch())

    const history = normalizeMatch(normalized, 'p3', 18)
    assert.equal(history.teamPlacement, 2)
    assert.equal(history.partnerPuuid, 'p4')
    assert.deepEqual(history.units.map(u => u.id), ['DA_18_Leona', 'DA_18_Camille'])
    assert.deepEqual(history.traits, [{ id: 'DA_18_Defender', numUnits: 2, tierCurrent: 1, style: 1 }])

    const comps = aggregateComps([normalized])
    const leona = comps.find(c => c.units.some(u => u.id === 'DA_18_Leona'))
    assert.ok(leona, 'comp containing DA_18_Leona is aggregated')
    assert.equal(leona.avgPlacement, 2)
    assert.deepEqual(leona.units.find(u => u.id === 'DA_18_Leona').items, ['DA_ThiefsGloves'])
    assert.equal(leona.topPartners[0].units.some(u => u.id === 'DA_Karma18'), true)
  })
})
