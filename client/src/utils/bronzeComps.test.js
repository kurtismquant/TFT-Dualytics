// Run with: node --test client/src/utils/bronzeComps.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeTraitStyle,
  bronzeRanges,
  buildEmblemOptions,
  findBronzeComps,
} from './bronzeComps.js'

// Shapes mirror /api/assets/traits and the builder roster for Set 18.
const OPEN = 25000
const traits = [
  { name: 'Coven', effects: [{ minUnits: 3, maxUnits: 3, style: 1 }, { minUnits: 4, maxUnits: OPEN, style: 3 }] },
  { name: 'Ravager', effects: [{ minUnits: 2, maxUnits: 3, style: 1 }, { minUnits: 4, maxUnits: OPEN, style: 3 }] },
  { name: 'Flora Fatalis', effects: [{ minUnits: 1, maxUnits: 1, style: 1 }, { minUnits: 2, maxUnits: OPEN, style: 5 }] },
  { name: 'Blossom', effects: [{ minUnits: 2, maxUnits: 3, style: 1 }, { minUnits: 4, maxUnits: OPEN, style: 3 }] },
  { name: 'Fae', effects: [{ minUnits: 2, maxUnits: 3, style: 1 }, { minUnits: 4, maxUnits: OPEN, style: 5 }] },
  // Unique trait and a trait whose first tier is gold: never bronze.
  { name: 'Avatar', effects: [{ minUnits: 1, maxUnits: OPEN, style: 4 }] },
  { name: 'Solar', effects: [{ minUnits: 3, maxUnits: OPEN, style: 5 }] },
]

const unit = (id, cost, unitTraits, extra = {}) => ({ id, name: id, cost, traits: unitTraits, ...extra })
const covenRavager1 = unit('CovenRavager1', 1, ['Coven', 'Ravager'])
const covenRavager2 = unit('CovenRavager2', 2, ['Coven', 'Ravager'])
const coven = unit('Coven3', 3, ['Coven'])
const flora = unit('Flora', 4, ['Flora Fatalis'])
const ravager = unit('Ravager', 1, ['Ravager'])
const solar = unit('Solar', 1, ['Solar'])
const blossomLux = unit('Blossom Lux', 5, ['Blossom', 'Avatar'], { traitWeights: { Blossom: 2 }, formOf: 'Lux' })
const faeLux = unit('Fae Lux', 5, ['Fae', 'Avatar'], { traitWeights: { Fae: 2 }, formOf: 'Lux' })

const ranges = bronzeRanges(traits)
const names = comp => comp.units.map(u => u.champion.id)

test('bronze ranges cover only traits with a bronze tier', () => {
  assert.deepEqual([...ranges], [
    ['Coven', { lo: 3, hi: 3 }],
    ['Ravager', { lo: 2, hi: 3 }],
    ['Flora Fatalis', { lo: 1, hi: 1 }],
    ['Blossom', { lo: 2, hi: 3 }],
    ['Fae', { lo: 2, hi: 3 }],
  ])
})

test('without maxUnits (cached assets) ranges end below the next tier', () => {
  const stripped = traits.map(t => ({ ...t, effects: t.effects.map(e => ({ minUnits: e.minUnits, style: e.style })) }))
  assert.deepEqual([...bronzeRanges(stripped)], [...ranges])
})

test('overlapping tiers resolve to the narrowest one (Rival)', () => {
  const rival = { name: 'Rival', effects: [
    { minUnits: 1, maxUnits: OPEN, style: 5 },
    { minUnits: 1, maxUnits: 1, style: 1 },
    { minUnits: 2, maxUnits: OPEN, style: 5 },
  ] }
  assert.deepEqual(bronzeRanges([rival]).get('Rival'), { lo: 1, hi: 1 })
  assert.equal(activeTraitStyle(rival, 1), 1)
  assert.equal(activeTraitStyle(rival, 2), 5)
  assert.equal(activeTraitStyle(rival, 0), null)
})

test('emblem options: one per name, only bronze-capable traits', () => {
  const items = [
    { id: 'DA_18_EmblemCoven', name: 'Coven Emblem', category: 'emblem' },
    { id: 'DA_18_EmblemSlayer', name: 'Ravager Emblem', category: 'emblem' },
    { id: 'DA_18_EmblemCovenAugment', name: 'Coven Emblem', category: 'emblem' },
    { id: 'DA_PhantomEmblem18', name: 'Phantom Emblem', category: 'emblem' },
    { id: 'DA_Deathblade', name: 'Deathblade', category: 'craftable' },
  ]
  assert.deepEqual(buildEmblemOptions(items, ranges), [
    { id: 'DA_18_EmblemCoven', name: 'Coven Emblem', trait: 'Coven' },
    { id: 'DA_18_EmblemSlayer', name: 'Ravager Emblem', trait: 'Ravager' },
  ])
})

const roster = [covenRavager1, covenRavager2, coven, flora, ravager, solar, blossomLux, faeLux]

test('finds the comp with the most bronze traits, fields one Lux at most', () => {
  // Blossom Lux + Fae Lux would be 2 bronze, but a board holds one Lux.
  const { comps, truncated } = findBronzeComps({ roster, ranges, size: 2 })
  assert.equal(truncated, false)
  assert.deepEqual(comps[0], {
    bronzeCount: 2,
    totalCost: 9,
    units: [
      { champion: flora, alternatives: [] },
      { champion: blossomLux, alternatives: [] },
    ],
    bronzeTraits: [{ name: 'Blossom', count: 2 }, { name: 'Flora Fatalis', count: 1 }],
    otherTraits: [{ name: 'Avatar', count: 1 }],
  })
  for (const comp of comps) {
    assert.equal(comp.units.length, 2)
    assert.ok(comp.units.filter(u => u.champion.formOf).length <= 1)
  }
})

test('an emblem adds +1 to its trait; ties go to the cheaper comp', () => {
  const { comps } = findBronzeComps({ roster, ranges, size: 2, emblemTraits: ['Coven'] })
  assert.deepEqual(comps[0], {
    bronzeCount: 2,
    totalCost: 3,
    units: [
      { champion: covenRavager1, alternatives: [] },
      { champion: covenRavager2, alternatives: [] },
    ],
    bronzeTraits: [{ name: 'Coven', count: 3 }, { name: 'Ravager', count: 2 }],
    otherTraits: [],
  })
})

test('interchangeable units collapse: cheapest shown, the rest as alternatives', () => {
  const { comps } = findBronzeComps({ roster: [covenRavager2, covenRavager1, solar], ranges, size: 1, emblemTraits: ['Ravager'] })
  assert.deepEqual(comps[0].units, [{ champion: covenRavager1, alternatives: [covenRavager2] }])
  assert.deepEqual(comps[0].bronzeTraits, [{ name: 'Ravager', count: 2 }])
})

test('fills spare slots with units that carry no bronze trait', () => {
  const { comps } = findBronzeComps({ roster: [covenRavager1, covenRavager2, solar], ranges, size: 3 })
  assert.equal(comps.length, 1)
  assert.deepEqual(names(comps[0]), ['CovenRavager1', 'Solar', 'CovenRavager2']) // by cost, then name
  assert.equal(comps[0].bronzeCount, 1)
})

test('a trait pushed past its bronze range into silver does not count', () => {
  // Forced to take all four: Ravager hits 4 (silver), Coven stops at 2.
  const ravager2 = unit('Ravager2', 2, ['Ravager'])
  const { comps } = findBronzeComps({ roster: [covenRavager1, covenRavager2, ravager, ravager2], ranges, size: 4 })
  assert.equal(comps.length, 1)
  assert.equal(comps[0].bronzeCount, 0)
  assert.deepEqual(comps[0].bronzeTraits, [])
  assert.deepEqual(comps[0].otherTraits, [{ name: 'Ravager', count: 4 }, { name: 'Coven', count: 2 }])
})
