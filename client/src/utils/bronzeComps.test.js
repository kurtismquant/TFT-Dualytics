// Run with: node --test client/src/utils/bronzeComps.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeTraitStyle,
  bronzeRanges,
  buildEmblemOptions,
  expandTraitChoices,
  findBronzeComps,
  traitRanges,
} from './bronzeComps.js'

// Shapes mirror /api/assets/traits and the builder roster for Set 18.
const OPEN = 25000
const tiers = (...list) => list.map(([minUnits, maxUnits, style]) => ({ minUnits, maxUnits, style }))
const traits = [
  { name: 'Coven', effects: tiers([3, 3, 1], [4, 5, 3], [6, OPEN, 5]) },
  { name: 'Ravager', effects: tiers([2, 3, 1], [4, OPEN, 3]) },
  { name: 'Flora Fatalis', effects: tiers([1, 1, 1], [2, OPEN, 5]) },
  { name: 'Blossom', effects: tiers([2, 3, 1], [4, 6, 3], [7, OPEN, 6]) },
  { name: 'Fae', effects: tiers([2, 3, 1], [4, OPEN, 5]) },
  // Unique trait and a trait whose first tier is gold: never bronze.
  { name: 'Avatar', effects: tiers([1, OPEN, 4]) },
  { name: 'Solar', effects: tiers([3, OPEN, 5]) },
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

test('silver and gold option widens ranges up to gold, never unique or prismatic', () => {
  assert.deepEqual([...traitRanges(traits, { includeSilverGold: true })], [
    ['Coven', { lo: 3, hi: OPEN }],
    ['Ravager', { lo: 2, hi: OPEN }],
    ['Flora Fatalis', { lo: 1, hi: OPEN }],
    ['Blossom', { lo: 2, hi: 6 }],
    ['Fae', { lo: 2, hi: OPEN }],
    ['Solar', { lo: 3, hi: OPEN }],
  ])
})

test('without maxUnits (cached assets) ranges end below the next tier', () => {
  const stripped = traits.map(t => ({ ...t, effects: t.effects.map(e => ({ minUnits: e.minUnits, style: e.style })) }))
  assert.deepEqual([...bronzeRanges(stripped)], [...ranges])
})

test('Rival is gold at 1 and 2 despite its 1-1 bronze row', () => {
  const rival = { name: 'Rival', effects: tiers([1, OPEN, 5], [1, 1, 1], [2, OPEN, 5]) }
  assert.equal(bronzeRanges([rival]).has('Rival'), false)
  assert.deepEqual(traitRanges([rival], { includeSilverGold: true }).get('Rival'), { lo: 1, hi: OPEN })
  assert.equal(activeTraitStyle(rival, 1), 5)
  assert.equal(activeTraitStyle(rival, 2), 5)
  assert.equal(activeTraitStyle(rival, 0), null)
})

test('emblem options: one per name, only traits that can count', () => {
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
    key: 'Flora|Blossom Lux',
    traitCount: 2,
    bonusEvolution: false,
    totalCost: 9,
    units: [
      { champion: flora, alternatives: [], required: false },
      { champion: blossomLux, alternatives: [], required: false },
    ],
    countedTraits: [{ name: 'Blossom', count: 2 }, { name: 'Flora Fatalis', count: 1 }],
    otherTraits: [{ name: 'Avatar', count: 1 }],
    nearTraits: [],
    usedEmblemTraits: [],
  })
  for (const comp of comps) {
    assert.equal(comp.units.length, 2)
    assert.ok(comp.units.filter(u => u.champion.formOf).length <= 1)
  }
})

test('an emblem adds +1 to its trait; trait ties go to the pricier comp', () => {
  const { comps } = findBronzeComps({ roster, ranges, size: 2, emblemTraits: ['Coven'] })
  assert.deepEqual(comps.slice(0, 3).map(c => [c.key, c.traitCount, c.totalCost]), [
    ['Flora|Blossom Lux', 2, 9],
    ['Flora|Fae Lux', 2, 9],
    ['CovenRavager1|CovenRavager2', 2, 3],
  ])
  const covenPair = comps[2]
  assert.deepEqual(covenPair.countedTraits, [{ name: 'Coven', count: 3 }, { name: 'Ravager', count: 2 }])
  assert.deepEqual(covenPair.usedEmblemTraits, ['Coven'])
  assert.deepEqual(comps[0].usedEmblemTraits, []) // Coven 1 there: emblem unused
})

test('lists traits one unit or emblem short of counting', () => {
  const { comps } = findBronzeComps({ roster: [covenRavager1, covenRavager2, flora], ranges, size: 2 })
  const covenPair = comps.find(c => c.key === 'CovenRavager1|CovenRavager2')
  assert.deepEqual(covenPair.countedTraits, [{ name: 'Ravager', count: 2 }])
  assert.deepEqual(covenPair.nearTraits, [{ name: 'Coven', count: 2, needed: 3 }])
  // Ravager 1 is one short too; traits the comp doesn't have at all are not listed.
  const withFlora = comps.find(c => c.key === 'CovenRavager2|Flora')
  assert.deepEqual(withFlora.nearTraits, [{ name: 'Ravager', count: 1, needed: 2 }])
})

test('interchangeable units collapse: priciest shown, the rest as alternatives', () => {
  const { comps } = findBronzeComps({ roster: [covenRavager1, covenRavager2, solar], ranges, size: 1, emblemTraits: ['Ravager'] })
  assert.deepEqual(comps[0].units, [{ champion: covenRavager2, alternatives: [covenRavager1], required: false }])
  assert.deepEqual(comps[0].countedTraits, [{ name: 'Ravager', count: 2 }])
})

test('fills spare slots with units that carry no bronze trait', () => {
  const { comps } = findBronzeComps({ roster: [covenRavager1, covenRavager2, solar], ranges, size: 3 })
  assert.equal(comps.length, 1)
  assert.deepEqual(names(comps[0]), ['CovenRavager1', 'Solar', 'CovenRavager2']) // by cost, then name
  assert.equal(comps[0].traitCount, 1)
})

test('a trait pushed past its bronze range into silver does not count', () => {
  // Forced to take all four: Ravager hits 4 (silver), Coven stops at 2.
  const ravager2 = unit('Ravager2', 2, ['Ravager'])
  const four = [covenRavager1, covenRavager2, ravager, ravager2]
  const { comps } = findBronzeComps({ roster: four, ranges, size: 4 })
  assert.equal(comps[0].traitCount, 0)
  assert.deepEqual(comps[0].otherTraits, [{ name: 'Ravager', count: 4 }, { name: 'Coven', count: 2 }])
  // ...unless silver and gold count too.
  const wide = findBronzeComps({ roster: four, ranges: traitRanges(traits, { includeSilverGold: true }), size: 4 })
  assert.deepEqual(wide.comps[0].countedTraits, [{ name: 'Ravager', count: 4 }])
})

test('required units are in every comp; too many for the board gives none', () => {
  const { comps } = findBronzeComps({ roster, ranges, size: 2, requiredIds: ['Coven3'] })
  assert.ok(comps.length > 0)
  for (const comp of comps) {
    assert.ok(names(comp).includes('Coven3'))
    assert.equal(comp.units.find(u => u.champion.id === 'Coven3').required, true)
  }
  // A required Lux form keeps the other forms out.
  const lux = findBronzeComps({ roster, ranges, size: 2, requiredIds: ['Blossom Lux'] })
  for (const comp of lux.comps) assert.ok(!names(comp).includes('Fae Lux'))
  assert.deepEqual(findBronzeComps({ roster, ranges, size: 1, requiredIds: ['Coven3', 'Flora'] }).comps, [])
})

// ── Kha'Zix: picks 3 of 4 evolution traits ─────────────────────────────────
const khaTraits = ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'].map(name => (
  { name, effects: tiers([2, 2, 1], [3, OPEN, 3]) }
))
const khaRanges = bronzeRanges([...khaTraits, { name: 'Rival', effects: tiers([1, OPEN, 5], [1, 1, 1], [2, OPEN, 5]) }])
const khazix = unit('DA_18_KhaZix', 3, ['Rival'])
const [exe, rap, rav, spe] = ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'].map(t => unit(t, 1, [t]))
const filler = unit('Filler', 1, ['Solar'])

test("Kha'Zix expands into each 3-trait evolution plus the full one", () => {
  const variants = expandTraitChoices([khazix])
  assert.equal(variants.length, 5)
  assert.deepEqual(variants.map(v => [v.chosenTraits.length, v.bonusEvolution]), [
    [3, false], [3, false], [3, false], [3, false], [4, true],
  ])
  assert.ok(variants.every(v => v.id === 'DA_18_KhaZix' && v.formOf === 'DA_18_KhaZix' && v.traits.includes('Rival')))
})

test('a 4th evolution that adds a trait ranks first within its trait count', () => {
  const { comps } = findBronzeComps({ roster: [khazix, exe, rap, rav, spe], ranges: khaRanges, size: 5 })
  const top = comps[0]
  assert.equal(top.traitCount, 4)
  assert.equal(top.bonusEvolution, true)
  assert.deepEqual(top.units.find(u => u.champion.id === 'DA_18_KhaZix').champion.chosenTraits,
    ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'])
})

test('a 4th evolution that adds nothing is dropped for the 3-trait one', () => {
  const { comps } = findBronzeComps({ roster: [khazix, exe, filler], ranges: khaRanges, size: 2, requiredIds: ['DA_18_KhaZix'] })
  assert.ok(comps.length > 0)
  for (const comp of comps) {
    assert.equal(comp.bonusEvolution, false)
    const kha = comp.units.find(u => u.champion.id === 'DA_18_KhaZix')
    assert.ok(kha, "required Kha'Zix in every comp")
    assert.equal(kha.champion.chosenTraits.length, 3)
  }
  assert.equal(comps[0].traitCount, 1)
  assert.deepEqual(names(comps[0]), ['Executioner', 'DA_18_KhaZix'])
})
