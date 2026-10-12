// Run with: node --test client/src/utils/traitTier.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { CHIP_STYLE_BY_EFFECT_STYLE, traitBreakpoints } from './traitTier.js'

test('Rival: two tiers at 1 collapse to the higher one, reading 1 > 2 in gold', () => {
  // Set 18 CDragon effects, in CDragon order.
  const rival = { effects: [
    { minUnits: 1, maxUnits: 25000, style: 5 },
    { minUnits: 1, maxUnits: 1, style: 1 },
    { minUnits: 2, maxUnits: 25000, style: 5 },
  ] }
  assert.deepEqual(traitBreakpoints(rival), [{ minUnits: 1, style: 5 }, { minUnits: 2, style: 5 }])
})

test('ordinary traits keep every breakpoint in order; inactive rows drop', () => {
  const elderwood = { effects: [
    { minUnits: 5, style: 3 }, { minUnits: 3, style: 1 }, { minUnits: null, style: 1 }, { minUnits: 7, style: 5 },
  ] }
  assert.deepEqual(traitBreakpoints(elderwood).map(b => b.minUnits), [3, 5, 7])
  assert.deepEqual(traitBreakpoints(null), [])
})

test('CDragon gold and prismatic map to the chip gold and prismatic classes', () => {
  assert.equal(CHIP_STYLE_BY_EFFECT_STYLE[1], 1) // bronze
  assert.equal(CHIP_STYLE_BY_EFFECT_STYLE[3], 2) // silver
  assert.equal(CHIP_STYLE_BY_EFFECT_STYLE[4], 3) // unique
  assert.equal(CHIP_STYLE_BY_EFFECT_STYLE[5], 4) // gold
  assert.equal(CHIP_STYLE_BY_EFFECT_STYLE[6], 5) // prismatic
})
