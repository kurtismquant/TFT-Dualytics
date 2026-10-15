// Run with: node --test client/src/store/boardStore.test.js
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useBoardStore } from './boardStore.js'

const store = () => useBoardStore.getState()
const units = () => Object.fromEntries(Object.entries(store().board).filter(([, c]) => c?.championId).map(([id, c]) => [id, c.championId]))

beforeEach(() => {
  useBoardStore.setState({ board: {}, past: [], future: [], activeTraits: {} })
  store().setRoster([
    { id: 'Sett', traits: ['Brawler'] },
    { id: 'Ahri', traits: ['Arcana'] },
  ])
  store().setItems([{ id: 'IE', name: 'Infinity Edge' }, { id: 'AE', name: 'Arcana Emblem' }, { id: 'BE', name: 'Brawler Emblem' }])
})

test('undo and redo step through board changes', () => {
  store().placeUnit('cell-0-0', 'Sett')
  store().placeUnit('cell-3-0', 'Ahri')
  store().removeUnit('cell-0-0')
  assert.deepEqual(units(), { 'cell-3-0': 'Ahri' })
  store().undo()
  assert.deepEqual(units(), { 'cell-0-0': 'Sett', 'cell-3-0': 'Ahri' })
  assert.deepEqual(store().activeTraits, { Brawler: 1, Arcana: 1 })
  store().undo()
  store().undo()
  assert.deepEqual(units(), {})
  store().undo() // nothing left: no-op
  store().redo()
  assert.deepEqual(units(), { 'cell-0-0': 'Sett' })
  // A new change after an undo drops the redo stack.
  store().placeUnit('cell-0-1', 'Ahri')
  assert.equal(store().future.length, 0)
})

test('a batch is a single undo step; clearing the board can be undone', () => {
  store().placeUnit('cell-0-0', 'Sett')
  store().batch(() => {
    store().clearBoard()
    store().placeInFirstAvailableHex('Ahri')
    store().placeInFirstAvailableHex('Sett')
  })
  assert.deepEqual(units(), { 'cell-0-0': 'Ahri', 'cell-0-1': 'Sett' })
  store().undo()
  assert.deepEqual(units(), { 'cell-0-0': 'Sett' })
  store().clearBoard()
  store().undo()
  assert.deepEqual(units(), { 'cell-0-0': 'Sett' })
})

test('items move between units, unless the target is full or the item does nothing there', () => {
  store().placeUnit('cell-0-0', 'Sett')
  store().placeUnit('cell-0-1', 'Ahri')
  store().setCellItems('cell-0-0', ['IE', 'AE', 'BE'].slice(0, 2))
  store().moveItem('cell-0-0', 1, 'cell-0-1') // Arcana Emblem onto Ahri (already Arcana): refused
  assert.deepEqual(store().board['cell-0-1'].items, [])
  store().moveItem('cell-0-0', 0, 'cell-0-1')
  assert.deepEqual(store().board['cell-0-0'].items, ['AE'])
  assert.deepEqual(store().board['cell-0-1'].items, ['IE'])
  store().setCellItems('cell-0-1', ['IE', 'IE', 'IE'])
  store().moveItem('cell-0-0', 0, 'cell-0-1') // full
  assert.deepEqual(store().board['cell-0-0'].items, ['AE'])
})
