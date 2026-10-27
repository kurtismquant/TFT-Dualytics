// Run with: node --test client/src/utils/bronzeLayout.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { bronzeLayout, unitLayout } from './bronzeLayout.js'

const desktop = { tabletDown: false }
const tablet = { tabletDown: true }

test('unitLayout: one line when the board fits, else two even lines, else stacked', () => {
  // 8 units on one line need 27.625rem beside the 12rem traits + 6.875rem fixed.
  assert.equal(unitLayout(46.5, 8), 'one')
  assert.equal(unitLayout(46.4, 8), 'two')
  // Two lines of 4 need 13.625rem.
  assert.equal(unitLayout(32.5, 8), 'two')
  assert.equal(unitLayout(32.4, 8), 'stacked')
})

test('the sidebar stays left while rows beside it keep their traits alongside', () => {
  assert.deepEqual(bronzeLayout(70, 8, desktop), { sidebar: 'side', unitLayout: 'one' })
  assert.deepEqual(bronzeLayout(60, 8, desktop), { sidebar: 'side', unitLayout: 'two' })
})

test('the sidebar moves above the results instead of rows stacking beside it', () => {
  // Beside the sidebar 8 units would stack; above, the full width fits one line.
  assert.deepEqual(bronzeLayout(50, 8, desktop), { sidebar: 'top', unitLayout: 'one' })
})

test('the switch depends on the biggest board listed', () => {
  // Two lines of 6 need 20.625rem: a 60rem page keeps the sidebar, 58rem doesn't.
  assert.deepEqual(bronzeLayout(60, 12, desktop), { sidebar: 'side', unitLayout: 'two' })
  assert.deepEqual(bronzeLayout(58, 12, desktop), { sidebar: 'top', unitLayout: 'two' })
})

test('tablets and phones always put the sidebar on top; phones stack the rows', () => {
  assert.deepEqual(bronzeLayout(70, 8, tablet), { sidebar: 'top', unitLayout: 'one' })
  assert.deepEqual(bronzeLayout(20, 8, tablet), { sidebar: 'top', unitLayout: 'stacked' })
})
