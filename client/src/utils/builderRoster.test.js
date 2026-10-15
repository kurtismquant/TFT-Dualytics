// Run with: node --test client/src/utils/builderRoster.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { listedRoster, toBuilderRoster, withFormBases } from './builderRoster.js'

// Shapes mirror /api/assets/champions for Set 18.
const fixture = () => [
  { id: 'DA_Lux18_Base', name: 'Lux', cost: 5, traits: ['Avatar'] },
  { id: 'DA_Lux18_Blossom', name: 'Lux (Blossom)', cost: 5, traits: ['Blossom', 'Avatar'] },
  { id: 'DA_18_Lux_Moonbeam', name: 'Lux (Lunar)', cost: 5, traits: ['Lunar', 'Avatar'] },
  { id: 'DA_18_Xayah', name: 'Xayah', cost: 4, traits: ['Fae', 'Sniper'] },
]

test('drops base Lux and renames forms to "<Form> Lux" with a double form trait', () => {
  const roster = toBuilderRoster(fixture())
  assert.deepEqual(roster, [
    { id: 'DA_Lux18_Blossom', name: 'Blossom Lux', cost: 5, traits: ['Blossom', 'Avatar'], traitWeights: { Blossom: 2 }, formOf: 'DA_Lux18_Base' },
    { id: 'DA_18_Lux_Moonbeam', name: 'Lunar Lux', cost: 5, traits: ['Lunar', 'Avatar'], traitWeights: { Lunar: 2 }, formOf: 'DA_Lux18_Base' },
    { id: 'DA_18_Xayah', name: 'Xayah', cost: 4, traits: ['Fae', 'Sniper'] },
  ])
})

test('does not mutate the input list', () => {
  const input = fixture()
  const snapshot = structuredClone(input)
  toBuilderRoster(input)
  assert.deepEqual(input, snapshot)
})

test('passes everything through when base Lux is absent', () => {
  const input = [{ id: 'DA_18_Xayah', name: 'Xayah', cost: 4, traits: ['Fae'] }]
  assert.deepEqual(toBuilderRoster(input), input)
})

test('desktop lists one base Lux to pick a form for; mobile lists every form', () => {
  const roster = withFormBases(toBuilderRoster(fixture()), fixture())
  // Lookups find the forms and the base, flagged pickForm.
  assert.deepEqual(roster.map(c => c.id), ['DA_Lux18_Blossom', 'DA_18_Lux_Moonbeam', 'DA_18_Xayah', 'DA_Lux18_Base'])
  assert.deepEqual(roster.at(-1), { id: 'DA_Lux18_Base', name: 'Lux', cost: 5, traits: ['Avatar'], pickForm: true })
  assert.deepEqual(listedRoster(roster, { collapseForms: true }).map(c => c.id), ['DA_18_Xayah', 'DA_Lux18_Base'])
  assert.deepEqual(listedRoster(roster, { collapseForms: false }).map(c => c.id), ['DA_Lux18_Blossom', 'DA_18_Lux_Moonbeam', 'DA_18_Xayah'])
})
