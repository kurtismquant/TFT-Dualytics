import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isCurrentSetId,
  selectSetEntry,
  selectSetUnits,
  unhashVariables,
} from '../services/assetResolver.js'

// Shapes mirror CDragon's cdragon/tft/en_us.json setData entries.
const setData = [
  { number: 17, mutator: 'TFTSet17', champions: [{ apiName: 'TFT17_Ahri', traits: ['Arcanist'] }] },
  { number: 18, mutator: 'TFTSet18_PVEMODE', champions: [] },
  {
    number: 18,
    mutator: 'TFTSet18',
    champions: [
      { apiName: 'TFT_BlueGolem', traits: [] },
      { apiName: 'TFT_ArmoryKeyCompleted', traits: [] },
      { apiName: 'DA_18_Xayah', traits: ['Lunar', 'Rival', 'Rapidfire'] },
      { apiName: 'DA_Vi18', traits: ['Primal', 'Brawler'] },
      { apiName: 'DA_Gromp18_AP', traits: ['Riftbeast', 'Adaptor'] },
    ],
  },
]

describe('selectSetEntry', () => {
  it('picks the base set entry over PvE/event variants', () => {
    assert.equal(selectSetEntry(setData, 18).mutator, 'TFTSet18')
    assert.equal(selectSetEntry(setData, 17).mutator, 'TFTSet17')
    assert.equal(selectSetEntry(setData, 99), null)
    assert.equal(selectSetEntry(undefined, 18), null)
  })

  it('prefers the Double Up (_PAIRS) entry when one exists', () => {
    const withPairs = [...setData, { number: 18, mutator: 'TFTSet18_PAIRS', champions: [] }]
    assert.equal(selectSetEntry(withPairs, 18).mutator, 'TFTSet18_PAIRS')
  })
})

describe('selectSetUnits', () => {
  it('keeps only traited units, whatever their apiName shape', () => {
    const ids = selectSetUnits(selectSetEntry(setData, 18)).map(c => c.apiName)
    assert.deepEqual(ids, ['DA_18_Xayah', 'DA_Vi18', 'DA_Gromp18_AP'])
  })
})

describe('isCurrentSetId', () => {
  it('matches both the legacy TFT<n>_ and the Set 18 DA_ id shapes', () => {
    assert.equal(isCurrentSetId('DA_18_Xayah', 18), true)
    assert.equal(isCurrentSetId('DA_Vi18', 18), true)
    assert.equal(isCurrentSetId('DA_Gromp18_AP', 18), true)
    assert.equal(isCurrentSetId('TFT18_Ahri', 18), true)
    assert.equal(isCurrentSetId('TFT17_Ahri', 18), false)
    assert.equal(isCurrentSetId('DA_Unit118', 18), false)
    assert.equal(isCurrentSetId('', 18), false)
  })
})

describe('unhashVariables', () => {
  it('restores FNV-1a hashed names from the @Token@ names in the description', () => {
    const desc = '(@MinUnits@) @EssencePerDeath@ Essence per kill, @EssencePerLoss@ per loss'
    const vars = { '{7a9d7f0e}': 2, '{de46577b}': 18, '{deadbeef}': 5, Plain: 1 }
    assert.deepEqual(unhashVariables(vars, desc), [
      { name: 'EssencePerDeath', value: 2 },
      { name: 'EssencePerLoss', value: 18 },
      { name: '{deadbeef}', value: 5 }, // no matching token → passes through
      { name: 'Plain', value: 1 },
    ])
  })

  it('returns plain variables unchanged in array form', () => {
    assert.deepEqual(unhashVariables([{ name: 'Damage', value: [0, 1, 2, 3] }], ''), [{ name: 'Damage', value: [0, 1, 2, 3] }])
    assert.deepEqual(unhashVariables(null, 'x'), [])
  })
})
