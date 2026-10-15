// Run with: node --test client/src/utils/autoArrange.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { arrangeBoard, neighbors, pickCell, unitRole } from './autoArrange.js'

const unit = (key, role, cost, attribute = null) => ({ key, role, cost, attribute, carry: 0 })
const layout = units => Object.fromEntries([...arrangeBoard(units)].sort(([a], [b]) => a.localeCompare(b)))
// A placed unit for pickCell, at its cellId.
const at = (cellId, role, cost = 1, attribute = null) => {
  const [, row, col] = cellId.split('-').map(Number)
  return { key: cellId, row, col, role, cost, attribute }
}

test('hex neighbours follow the odd-row offset', () => {
  // Row 0 (even) touches row 1 at cols c-1 and c; row 1 (odd) touches rows 0/2 at c and c+1.
  assert.deepEqual(neighbors(0, 3), [[0, 2], [0, 4], [1, 2], [1, 3]])
  assert.deepEqual(neighbors(1, 3), [[1, 2], [1, 4], [0, 3], [0, 4], [2, 3], [2, 4]])
})

test('roles come from range and the items a unit holds', () => {
  const melee = { stats: { range: 1 } }
  assert.deepEqual(unitRole(melee, { tank: 0.9, ad: 0.05, ap: 0.1, itemsPerBoard: 1 }), { role: 'tank', attribute: 'ap' })
  assert.deepEqual(unitRole(melee, { tank: 0.2, ad: 0.6, ap: 0.3, itemsPerBoard: 2.5 }), { role: 'assassin', attribute: 'ad' })
  assert.deepEqual(unitRole(melee, undefined), { role: 'tank', attribute: null })
  assert.equal(unitRole({ stats: { range: 2 } }, undefined).role, 'mid')
  assert.deepEqual(unitRole({ stats: { range: 6 } }, { tank: 0.1, ad: 0.2, ap: 0.7, itemsPerBoard: 2 }), { role: 'ranged', attribute: 'ap' })
})

test('auto-arrange: assassin beside the tanks, AD and AP carries split into the corners one hex apart', () => {
  assert.deepEqual(layout([
    unit('T4', 'tank', 4), unit('T1', 'tank', 1), unit('A3', 'assassin', 3),
    unit('R5', 'ranged', 5, 'ad'), unit('R4', 'ranged', 4, 'ap'), unit('R3', 'ranged', 3, 'ad'), unit('R1', 'ranged', 1, 'ap'),
  ]), {
    A3: 'cell-0-2', T4: 'cell-0-3', T1: 'cell-0-4',
    R5: 'cell-3-0', R3: 'cell-3-2', R1: 'cell-3-4', R4: 'cell-3-6',
  })
})

test('auto-arrange: one attribute puts the top two carries in both corners', () => {
  assert.deepEqual(layout([
    unit('T', 'tank', 2), unit('R5', 'ranged', 5, 'ad'), unit('R4', 'ranged', 4, 'ad'), unit('R2', 'ranged', 2, 'ad'),
  ]), { T: 'cell-0-3', R5: 'cell-3-0', R4: 'cell-3-6', R2: 'cell-3-2' })
})

test('auto-arrange: pricier tanks on the edges, range 2 in the second row, back line bunched behind 6+ front units', () => {
  assert.deepEqual(layout([
    unit('T5', 'tank', 5), unit('T4', 'tank', 4), unit('T3', 'tank', 3), unit('T2', 'tank', 2), unit('T1', 'tank', 1),
    unit('M', 'mid', 4), unit('R2', 'ranged', 2, 'ad'), unit('R5', 'ranged', 5, 'ap'),
  ]), {
    T5: 'cell-0-1', T3: 'cell-0-2', T1: 'cell-0-3', T2: 'cell-0-4', T4: 'cell-0-5',
    M: 'cell-1-3',
    R5: 'cell-3-0', R2: 'cell-3-1',
  })
})

test('auto-arrange: a full front row drops extra assassins, then the cheapest tanks, to the second row', () => {
  const units = [
    ...[6, 5, 4, 3, 2, 1].map(cost => unit(`T${cost}`, 'tank', cost)),
    ...[3, 2, 1].map(cost => unit(`A${cost}`, 'assassin', cost)),
  ]
  const placed = layout(units)
  const row = n => Object.keys(placed).filter(key => placed[key].startsWith(`cell-${n}-`)).sort()
  assert.deepEqual(row(0), ['A2', 'A3', 'T2', 'T3', 'T4', 'T5', 'T6'])
  assert.deepEqual(row(1), ['A1', 'T1'])
  // The two kept assassins flank the tank line.
  assert.equal(placed.A3, 'cell-0-0')
  assert.equal(placed.A2, 'cell-0-6')
})

test('placing a tank puts it next to an assassin, and vice versa', () => {
  assert.equal(pickCell([at('cell-0-3', 'assassin')], { key: 'new', role: 'tank', cost: 2 }), 'cell-0-2')
  // The tank already has an assassin on its left, so a second assassin takes its free side.
  assert.equal(
    pickCell([at('cell-0-2', 'assassin'), at('cell-0-3', 'tank')], { key: 'new', role: 'assassin', cost: 1 }),
    'cell-0-4',
  )
})

test('placing range 2 goes to the second row, next to its row', () => {
  assert.equal(pickCell([at('cell-1-3', 'mid')], { key: 'new', role: 'mid', cost: 1 }), 'cell-1-2')
})

test('placing a ranged carry: opposite corner for the other attribute, one hex gap for a cheap one', () => {
  const back = [at('cell-3-0', 'ranged', 5, 'ad')]
  assert.equal(pickCell(back, { key: 'new', role: 'ranged', cost: 4, attribute: 'ap' }), 'cell-3-6')
  const corners = [at('cell-3-0', 'ranged', 5, 'ad'), at('cell-3-6', 'ranged', 4, 'ad')]
  assert.equal(pickCell(corners, { key: 'new', role: 'ranged', cost: 1, attribute: 'ad' }), 'cell-3-2')
})

test('placing a ranged unit behind 6+ front units joins the back line on its side', () => {
  const front = ['cell-0-1', 'cell-0-2', 'cell-0-3', 'cell-0-4', 'cell-0-5', 'cell-1-3'].map(id => at(id, 'tank'))
  assert.equal(pickCell([...front, at('cell-3-6', 'ranged', 5, 'ad')], { key: 'new', role: 'ranged', cost: 3, attribute: 'ap' }), 'cell-3-5')
})

test('a full board has no cell', () => {
  const full = []
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) full.push(at(`cell-${row}-${col}`, 'tank'))
  assert.equal(pickCell(full, { key: 'new', role: 'tank', cost: 1 }), null)
})
