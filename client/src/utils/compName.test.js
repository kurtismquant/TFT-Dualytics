// Run with: node --test client/src/utils/compName.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateCompName, getUniqueTraitIds } from './compName.js'

// champion.traits hold trait DISPLAY NAMES; comp/match trait ids are apiNames.
// The fixtures keep these distinct (id !== name) so the tests exercise the real
// name → apiName translation rather than masking it with id === name.
const champions = [
  { id: 'Veigar', name: 'Veigar', cost: 5, traits: ['Mystic', 'Sorcerer'] },
  { id: 'Ahri', name: 'Ahri', cost: 4, traits: ['Mystic', 'Sorcerer'] },
  { id: 'Poppy', name: 'Poppy', cost: 1, traits: ['Mystic', 'Bastion'] },
  { id: 'TahmKench', name: 'Tahm Kench', cost: 2, traits: ['Mystic'] },
  { id: 'Lulu', name: 'Lulu', cost: 1, traits: ['Sorcerer'] },
  // Aatrox is the only champion with the "Apex" trait → unique.
  { id: 'Aatrox', name: 'Aatrox', cost: 5, traits: ['Apex', 'Bastion'] },
]

const traits = [
  { id: 'TFT17_Mystic', name: 'Mystic' },
  { id: 'TFT17_Sorcerer', name: 'Sorcerer' },
  { id: 'TFT17_Bastion', name: 'Bastion' },
  { id: 'TFT17_Apex', name: 'Apex' },
]

test('getUniqueTraitIds returns apiNames for single-champion traits only', () => {
  const unique = getUniqueTraitIds(champions, traits)
  // Returned ids are apiNames (matching the t.id the chip filters check), not display names.
  assert.ok(unique.has('TFT17_Apex'))
  assert.ok(!unique.has('Apex'))
  assert.ok(!unique.has('TFT17_Mystic'))
  assert.ok(!unique.has('TFT17_Sorcerer'))
})

test('name is "{Trait} {Unit}": highest-count trait, no number, plus the carry', () => {
  const comp = {
    units: [{ id: 'Veigar', items: ['x', 'y', 'z'] }],
    traits: [
      { id: 'TFT17_Mystic', numUnits: 6, style: 4, tierCurrent: 3 },
      { id: 'TFT17_Sorcerer', numUnits: 2, style: 2, tierCurrent: 1 },
    ],
  }
  assert.equal(generateCompName(comp, { champions, traits }), 'Mystic Veigar')
})

test('higher unit count beats higher tier ("5 Meeple over 3 Arbiter")', () => {
  const comp = {
    units: [{ id: 'Veigar', items: ['x', 'y', 'z'] }],
    traits: [
      { id: 'TFT17_Mystic', numUnits: 5, style: 3, tierCurrent: 2 }, // more units, lower tier
      { id: 'TFT17_Sorcerer', numUnits: 3, style: 5, tierCurrent: 3 }, // fewer units, higher tier
    ],
  }
  // Mystic wins on count even though Sorcerer's tier (style) is higher.
  assert.equal(generateCompName(comp, { champions, traits }), 'Mystic Veigar')
})

test('unique traits are ignored even at higher count', () => {
  const comp = {
    units: [{ id: 'Aatrox', items: ['x', 'y', 'z'] }],
    traits: [
      { id: 'TFT17_Apex', numUnits: 9, style: 5, tierCurrent: 1 }, // unique → ignored
      { id: 'TFT17_Mystic', numUnits: 4, style: 4, tierCurrent: 2 }, // real headline
    ],
  }
  assert.equal(generateCompName(comp, { champions, traits }), 'Mystic Aatrox')
})

test('the most-itemized unit wins; higher cost breaks ties', () => {
  const comp = {
    units: [
      { id: 'Lulu', items: ['a', 'b', 'c'] }, // 3 items, cost 1
      { id: 'Ahri', items: ['a', 'b', 'c'] }, // 3 items, cost 4 → primary carry
      { id: 'Poppy', items: [] },
    ],
    traits: [{ id: 'TFT17_Sorcerer', numUnits: 2, style: 2, tierCurrent: 1 }],
  }
  assert.equal(generateCompName(comp, { champions, traits }), 'Sorcerer Ahri')
})

test('falls back to highest-cost unit when nothing is itemized', () => {
  const comp = {
    units: [
      { id: 'Poppy', items: [] }, // cost 1
      { id: 'Veigar', items: [] }, // cost 5 → fallback unit
    ],
    traits: [{ id: 'TFT17_Mystic', numUnits: 3, style: 3, tierCurrent: 2 }],
  }
  assert.equal(generateCompName(comp, { champions, traits }), 'Mystic Veigar')
})

test('unit only when no non-unique trait exists', () => {
  const comp = {
    units: [{ id: 'Ahri', items: ['a', 'b', 'c'] }, { id: 'Poppy', items: [] }],
    traits: [{ id: 'TFT17_Apex', numUnits: 1, style: 1, tierCurrent: 1 }], // unique → ignored
  }
  assert.equal(generateCompName(comp, { champions, traits }), 'Ahri')
})

test('name is capped under 25 characters', () => {
  const longChamps = [{ id: 'Long', name: 'Supercalifragilisticexpialidocious', cost: 5, traits: [] }]
  const comp = { units: [{ id: 'Long', items: ['a', 'b', 'c'] }], traits: [] }
  const name = generateCompName(comp, { champions: longChamps, traits: [] })
  assert.ok(name.length < 25, `expected < 25 chars, got "${name}" (${name.length})`)
})
