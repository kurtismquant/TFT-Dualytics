// Run with: node --test client/src/utils/descriptionTokenizer.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { tokenize } from './descriptionTokenizer.js'

// Set 18 CDragon shape: calculated tokens, bare scale icons after the token.
const desc = 'Deal @MagicDamageCalc1@ %i:scaleAD%%i:scaleAP% magic damage and reduce Magic Resist by @MRReduction@ for @Duration@ seconds.'

test('renders server-resolved calculations and keeps the description\'s scale icons', () => {
  const calculations = {
    MagicDamageCalc1: [{ values: [0, 160, 240, 360] }],
    MRReduction: [{ values: [0, 10, 10, 10] }],
  }
  const nodes = tokenize(desc, [], 'DA_18_Sentry', {}, calculations)
  assert.deepEqual(nodes, [
    { type: 'text', content: 'Deal ' },
    { type: 'var', content: '160/240/360' },
    { type: 'text', content: ' ' },
    { type: 'icon', iconType: 'ad' },
    { type: 'icon', iconType: 'ap' },
    { type: 'text', content: ' magic damage and reduce Magic Resist by ' },
    { type: 'var', content: '10' },
    { type: 'text', content: ' for ' },
    // @Duration@ unresolved → dropped, as before.
    { type: 'text', content: ' seconds.' },
  ])
})

test('matches calculations case-insensitively and applies *N (percent-of) multipliers and percent display', () => {
  const nodes = tokenize('gain @modifiedas*50@ and @Chance@ bonus', [], 'X', {}, {
    ModifiedAS: [{ values: [0, 20, 30, 40] }],
    Chance: [{ values: [0, 0.25, 0.25, 0.25], percent: true }],
  })
  const vars = nodes.filter(n => n.type === 'var').map(n => n.content)
  assert.deepEqual(vars, ['10/15/20', '25%'])
})

test('without calculations, unresolved tokens drop along with their scale icons', () => {
  const nodes = tokenize('Deal @MagicDamageCalc1@ %i:scaleAP% magic damage.', [], 'X', {})
  assert.deepEqual(nodes, [
    { type: 'text', content: 'Deal ' },
    // The scale-icon gap swallows the following space.
    { type: 'text', content: 'magic damage.' },
  ])
})
