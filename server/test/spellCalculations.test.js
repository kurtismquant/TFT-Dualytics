import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateCalculations, isTemplateSpell, pickAbilitySpell } from '../services/spellCalculations.js'

// Trimmed from raw.communitydragon.org/latest/game/characters/tft17_kaisa.cdtb.bin.json.
const kaisaSpell = {
  DataValues: [
    { name: 'BaseNumMissiles', values: [16, 16, 16, 16, 16, 16, 16] },
    { name: 'ADDamage', values: [0, 30, 45, 72, 0, 0, 0] },
    { name: 'APDamage', values: [0, 3, 5, 7, 0, 0, 0] },
  ],
  mSpellCalculations: {
    TotalDamage: {
      mFormulaParts: [{
        mSubparts: [
          { mSubpart: { mDataValue: 'ADDamage', __type: 'NamedDataValueCalculationPart' }, mRatio: 1, mStat: 3, __type: 'SubPartScaledProportionalToStat' },
          { mSubpart: { mDataValue: 'APDamage', __type: 'NamedDataValueCalculationPart' }, mRatio: 0.01, __type: 'SubPartScaledProportionalToStat' },
        ],
        __type: 'SumOfSubPartsCalculationPart',
      }],
      __type: 'GameCalculation',
    },
  },
}

// Set 18 placeholder spell — what every DA_ unit bin currently ships.
const templateSpell = {
  DataValues: [
    { name: 'DataValue', values: [0, 1, 2, 10, 160, 200, 240] },
    { name: 'OtherValue', values: [0, 100, 200, 1000, 0, 0, 0] },
  ],
  mSpellCalculations: {
    '{d678dbfb}': {
      mFormulaParts: [{ mSubpart: { mDataValue: 'OtherValue', __type: 'NamedDataValueCalculationPart' }, mRatio: 0.01, __type: 'SubPartScaledProportionalToStat' }],
      __type: 'GameCalculation',
    },
  },
}

const stats = { damage: 50, hp: 700, armor: 40, magicResist: 40, attackSpeed: 0.75 }
const round = (parts) => parts.map(p => ({ ...p, values: p.values.map(x => Math.round(x * 100) / 100) }))

describe('evaluateCalculations', () => {
  it('sums AD- and AP-scaled parts into one tooltip value at the 100% AD / 100 AP baseline', () => {
    const out = evaluateCalculations(kaisaSpell, stats)
    assert.deepEqual(round(out.TotalDamage), [{ values: [0, 33, 50, 79] }])
  })

  it('exposes raw DataValues so plain tokens resolve too', () => {
    const out = evaluateCalculations(kaisaSpell, stats)
    assert.deepEqual(out.BaseNumMissiles, [{ values: [16, 16, 16, 16] }])
  })

  it('scales total AD and max HP by star level', () => {
    const spell = {
      DataValues: [{ name: 'Ratio', values: [0, 2, 2, 2] }, { name: 'HpPct', values: [0, 0.1, 0.1, 0.1] }],
      mSpellCalculations: {
        Damage: { mFormulaParts: [{ mStat: 2, mDataValue: 'Ratio', __type: 'StatByNamedDataValueCalculationPart' }], __type: 'GameCalculation' },
        Heal: { mFormulaParts: [{ mStat: 12, mSubpart: { mDataValue: 'HpPct', __type: 'NamedDataValueCalculationPart' }, __type: 'StatBySubPartCalculationPart' }], __type: 'GameCalculation' },
      },
    }
    const out = evaluateCalculations(spell, stats)
    assert.deepEqual(round(out.Damage), [{ values: [0, 100, 180, 324] }])
    assert.deepEqual(round(out.Heal), [{ values: [0, 70, 126, 226.8] }])
  })

  it('follows calculation references and marks percent displays', () => {
    const spell = {
      DataValues: [{ name: 'Mult', values: [0, 0.5, 0.5, 0.5] }],
      mSpellCalculations: {
        ...kaisaSpell.mSpellCalculations,
        Reduced: {
          mFormulaParts: [{
            mPart1: { mSpellCalculationKey: 'TotalDamage', __type: '{f3cbe7b2}' },
            mPart2: { mDataValue: 'Mult', __type: 'NamedDataValueCalculationPart' },
            __type: 'ProductOfSubPartsCalculationPart',
          }],
          mDisplayAsPercent: true,
          __type: 'GameCalculation',
        },
      },
    }
    spell.DataValues.push(...kaisaSpell.DataValues)
    const out = evaluateCalculations(spell, stats)
    assert.deepEqual(round(out.Reduced), [{ values: [0, 16.5, 25, 39.5], percent: true }])
  })

  it('skips calculations that depend on combat state instead of guessing', () => {
    const spell = {
      DataValues: [{ name: 'PerStack', values: [0, 5, 5, 5] }],
      mSpellCalculations: {
        Stacks: { mFormulaParts: [{ mBuffName: '{743a49ea}', mDataValue: 'PerStack', __type: 'BuffCounterByNamedDataValueCalculationPart' }], __type: 'GameCalculation' },
        Range: { mFormulaParts: [{ mStat: 31, mCoefficient: 0.005, __type: 'StatByCoefficientCalculationPart' }], __type: 'GameCalculation' },
      },
    }
    const out = evaluateCalculations(spell, stats)
    assert.equal(out.Stacks, undefined)
    assert.equal(out.Range, undefined)
    assert.deepEqual(out.PerStack, [{ values: [0, 5, 5, 5] }])
  })

  it('returns null for the Set 18 placeholder spell and for no spell', () => {
    assert.equal(isTemplateSpell(templateSpell), true)
    assert.equal(evaluateCalculations(templateSpell, stats), null)
    assert.equal(evaluateCalculations(null, stats), null)
  })
})

describe('pickAbilitySpell', () => {
  it('picks the cast spell, not the basic attack', () => {
    const bin = {
      'Characters/X/Spells/TFT17_XBasicAttack': { __type: 'SpellObject', mSpell: { DataValues: [] } },
      'Characters/X/Spells/TFT17_XSpell': { __type: 'SpellObject', mSpell: kaisaSpell },
      'Characters/X/CharacterRecords/Root': { __type: 'TFTCharacterRecord' },
    }
    assert.equal(pickAbilitySpell(bin), kaisaSpell)
    assert.equal(pickAbilitySpell(null), null)
  })
})
