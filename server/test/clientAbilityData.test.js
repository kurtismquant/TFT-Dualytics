import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadClientAbilityData, resolveClientTokens } from '../services/clientAbilityData.js'

// Shape of a data/abilityData.set18.json entry.
const entry = {
  icon: '/assets/abilities/set18/DA_18_Vi.png',
  tokens: { HealthCalc3: [200, 265, 360], Duration: [9, 9, 9] },
  rows: { SpellDurability: [0.15, 0.15, 0.15], SpellDuration: [3, 3, 3], Duration: [1, 1, 1], Broken: [1, 2] },
}

describe('resolveClientTokens', () => {
  it('fills calculation and curve-row tokens in the tokenizer shape', () => {
    const desc = 'Restore @HealthCalc3@ %i:scaleAP% Health, gain @SpellDurability*100@% Durability for @spell_duration@ seconds.'
    assert.deepEqual(resolveClientTokens(desc, entry), {
      HealthCalc3: [{ values: [0, 200, 265, 360] }],
      SpellDurability: [{ values: [0, 0.15, 0.15, 0.15] }], // *100 stays for the tokenizer to apply
      spell_duration: [{ values: [0, 3, 3, 3] }], // case/punctuation-insensitive
    })
  })

  it('accepts the "Modified" prefix and prefers a calculation over a same-named row', () => {
    assert.deepEqual(resolveClientTokens('@ModifiedHealthCalc3@ for @Duration@s', entry), {
      ModifiedHealthCalc3: [{ values: [0, 200, 265, 360] }],
      Duration: [{ values: [0, 9, 9, 9] }],
    })
  })

  it('skips icon refs, unknown tokens and malformed star arrays', () => {
    assert.deepEqual(resolveClientTokens('@%i:scaleAP@ @Unknown@ @Broken@', entry), {})
    assert.deepEqual(resolveClientTokens('@HealthCalc3@', undefined), {})
  })

  it("applies the client tooltip's format hints unless the token scales itself", () => {
    const formatted = {
      rows: { SpellAS: [1.85, 2, 2.25], EmpoweredAPPercent: [1, 1, 1.5], Ratio: [0.4, 0.4, 0.4] },
      formats: { SpellAS: 'percentMinusOne', EmpoweredAPPercent: 'percent', Ratio: 'percent' },
    }
    assert.deepEqual(resolveClientTokens('gain @SpellAS@ AS and @EmpoweredAPPercent@ AP, @Ratio*100@%', formatted), {
      SpellAS: [{ values: [0, 0.85, 1, 1.25], percent: true }], // shown 85%/100%/125%
      EmpoweredAPPercent: [{ values: [0, 1, 1, 1.5], percent: true }], // 100%/150%, not "1/1.5"
      Ratio: [{ values: [0, 0.4, 0.4, 0.4] }], // CDragon's *100 already makes it a percentage
    })
  })
})

describe('loadClientAbilityData', () => {
  it('returns an empty map when a set has no extracted data', () => {
    assert.deepEqual(loadClientAbilityData(999), {})
  })
})
