import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildClientItem, loadClientItemData } from '../services/clientItemData.js'

// Shapes of data/itemData.set18.json entries (TFT client tooltip text).
const infinityEdge = {
  stats: '<TFTCurveTable row="AttackDamage" icon="Icon.AD" type="stat" format="percent"/> <TFTCurveTable row="CriticalStrikeChance" icon="Icon.CritChance" type="stat" format="percent"/>',
  desc: 'Gain <Keyword>Precision</>. \r\n\r\n<Rules>Precision: Ability damage can critically strike.</>',
  rows: { CriticalStrikeChance: 0.35, AttackDamage: 0.35 },
  tokens: {},
}

describe('buildClientItem', () => {
  it('turns the stat line into ItemCard stats and keeps plain text untouched', () => {
    assert.deepEqual(buildClientItem(infinityEdge), {
      effects: [
        { name: 'AttackDamage', value: 0.35, percent: true },
        { name: 'CritChance', value: 0.35, percent: true },
      ],
      desc: 'Gain <Keyword>Precision</>. \n\n<Rules>Precision: Ability damage can critically strike.</>',
      calculations: {},
    })
  })

  it('converts value tags and inline icons to tokenizer markup', () => {
    const bfSword = { stats: '', desc: '<img id="Icon.AD"/> +<TFTCurveTable row="AD%" format="percent"/> Attack Damage', rows: { 'AD%': 0.1 }, tokens: {} }
    const { desc, calculations } = buildClientItem(bfSword)
    assert.equal(desc, '%i:scaleAD% +@ItemValue0@ Attack Damage')
    assert.deepEqual(calculations, { ItemValue0: [{ values: [0, 0.1, 0.1, 0.1], percent: true }] })
  })

  it('applies the client formats: percent minus one, inverted percent, plain numbers', () => {
    const bramble = {
      stats: '<TFTCurveTable row="ArmorBase" type="stat" icon="Icon.Armor"/>',
      desc: 'Gain <TFTCurveTable row="MaxHealthMultiplier" format="percentMinusOne"/> max Health. Take <TFTCurveTable row="AADamageReduction" format="invertedPercent"/> reduced damage. Stun for <TFTCurveTable row="StunDuration"/> seconds.',
      rows: { ArmorBase: 50, MaxHealthMultiplier: 1.07, AADamageReduction: 0.92, StunDuration: 0.8 },
      tokens: {},
    }
    const { effects, desc, calculations } = buildClientItem(bramble)
    assert.deepEqual(effects, [{ name: 'Armor', value: 50 }])
    assert.equal(desc, 'Gain @ItemValue0@ max Health. Take @ItemValue1@ reduced damage. Stun for @ItemValue2@ seconds.')
    assert.deepEqual(calculations, {
      ItemValue0: [{ values: [0, 0.07, 0.07, 0.07], percent: true }],
      ItemValue1: [{ values: [0, 0.08, 0.08, 0.08], percent: true }],
      ItemValue2: [{ values: [0, 0.8, 0.8, 0.8], plain: true }], // a 0.8s stun, not "80%"
    })
  })

  it('uses evaluated calculations, then the shop fallback row', () => {
    const nashors = {
      stats: '<TFTAttribute attributeId="TFTCalculationAttributes.HealthCalc1" icon="icon.Health" type="stat" fallbackRow="Base_Health"/>',
      desc: 'Attacks grant <TFTCurveTable row="ManaPerAttack"/> Mana, increased to <TFTAttribute attributeID="TFTCalculationAttributes.GenericCalc1" fallbackRow="Default_CritBonus"/> on crit.',
      rows: { ManaPerAttack: 2, Default_CritBonus: 4, Base_Health: 250 },
      tokens: { GenericCalc1: 4 },
    }
    const { effects, calculations } = buildClientItem(nashors)
    assert.deepEqual(effects, [{ name: 'Health', value: 250 }]) // HealthCalc1 not evaluated → fallbackRow
    assert.deepEqual(calculations.ItemValue1, [{ values: [0, 4, 4, 4], plain: true }])
  })

  it('drops live-game readouts and FText placeholders', () => {
    const gamblers = {
      stats: '',
      desc: 'Each attack drops gold.\r\n\r\nGold generated this game: <TFTAttribute attributeId="TFTItemAttributes.Stack" icon="Icon.Coin"/>\r\n\r\n<rules>Unique</>{ItemTags.Deathblade.DeadlierBladeStacks}',
      rows: {},
      tokens: {},
    }
    assert.equal(buildClientItem(gamblers).desc, 'Each attack drops gold.\n\n<rules>Unique</>')
  })

  it('keeps a literal "%" with its value, before the stat icon', () => {
    const silvermere = { stats: '', desc: '<TFTCurveTable row="Omnivamp" icon="icon.Omnivamp" type="stat"/>% Omnivamp', rows: { Omnivamp: 30 }, tokens: {} }
    assert.equal(buildClientItem(silvermere).desc, '@ItemValue0@% %i:scaleOmnivamp% Omnivamp')
  })

  it('returns null without client data', () => {
    assert.equal(buildClientItem(undefined), null)
  })
})

describe('loadClientItemData', () => {
  it('returns an empty map when a set has no extracted data', () => {
    assert.deepEqual(loadClientItemData(999), {})
  })
})
