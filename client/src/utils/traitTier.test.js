// Run with: node --test client/src/utils/traitTier.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { CHIP_STYLE_BY_EFFECT_STYLE, getTraitTierInfo, mergeTraitTierRows, traitBreakpoints } from './traitTier.js'

// Set 18 CDragon effects, in CDragon order.
const rival = { effects: [
  { minUnits: 1, maxUnits: 25000, style: 5 },
  { minUnits: 1, maxUnits: 1, style: 1 },
  { minUnits: 2, maxUnits: 25000, style: 5 },
] }

test('Rival: two tiers at 1 collapse to the higher one, reading 1 > 2 in gold', () => {
  assert.deepEqual(traitBreakpoints(rival), [{ minUnits: 1, style: 5 }, { minUnits: 2, style: 5 }])
})

test('Rival: Riot tier 2 (the hidden 1-1 bronze row) reads as gold 1, not bronze', () => {
  assert.deepEqual(getTraitTierInfo(rival, 1), { minUnits: 1, style: 'style5' })
  assert.deepEqual(getTraitTierInfo(rival, 2), { minUnits: 1, style: 'style5' })
  assert.deepEqual(getTraitTierInfo(rival, 3), { minUnits: 2, style: 'style5' })
  assert.deepEqual(getTraitTierInfo(rival, 4), { minUnits: null, style: null })
})

test('ordinary traits keep a distinct style per tier', () => {
  const blossom = { effects: [{ minUnits: 2, style: 1 }, { minUnits: 4, style: 3 }, { minUnits: 6, style: 5 }] }
  assert.deepEqual([1, 2, 3].map(tier => getTraitTierInfo(blossom, tier).style), ['style1', 'style3', 'style5'])
})

test('mergeTraitTierRows folds rows with the same label into one weighted row', () => {
  const rows = [
    { id: 'DA_18_Rival#1', traitId: 'DA_18_Rival', tier: 1, tierMin: 1, count: 30, frequency: 0.3,
      avgPlacement: 2, winRate: 0.5, avgUnits: 1, popularUnits: [{ id: 'A', count: 30 }, { id: 'B', count: 5 }] },
    { id: 'DA_18_Rival#3', traitId: 'DA_18_Rival', tier: 3, tierMin: 2, count: 8, frequency: 0.08,
      avgPlacement: 2.5, winRate: 0.4, avgUnits: 2, popularUnits: [] },
    { id: 'DA_18_Rival#2', traitId: 'DA_18_Rival', tier: 2, tierMin: 1, count: 10, frequency: 0.1,
      avgPlacement: 4, winRate: 0, avgUnits: 1, popularUnits: [{ id: 'B', count: 10 }] },
  ]
  const merged = mergeTraitTierRows(rows)
  assert.equal(merged.length, 2)
  const [one, two] = merged
  assert.equal(one.id, 'DA_18_Rival#1')
  assert.equal(one.tier, 1)
  assert.equal(one.count, 40)
  assert.ok(Math.abs(one.frequency - 0.4) < 1e-9)
  assert.equal(one.avgPlacement, 2.5) // (2*30 + 4*10) / 40
  assert.equal(one.winRate, 0.375)
  assert.equal(one.avgUnits, 1)
  assert.deepEqual(one.popularUnits, [{ id: 'A', count: 30 }, { id: 'B', count: 15 }])
  assert.equal(two, rows[1]) // untouched
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
