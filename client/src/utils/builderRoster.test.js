// Run with: node --test client/src/utils/builderRoster.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { toBuilderRoster } from './builderRoster.js'

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
    { id: 'DA_Lux18_Blossom', name: 'Blossom Lux', cost: 5, traits: ['Blossom', 'Avatar'], traitWeights: { Blossom: 2 } },
    { id: 'DA_18_Lux_Moonbeam', name: 'Lunar Lux', cost: 5, traits: ['Lunar', 'Avatar'], traitWeights: { Lunar: 2 } },
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
