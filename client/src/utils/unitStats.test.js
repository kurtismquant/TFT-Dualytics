// Run with: node --test client/src/utils/unitStats.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatStarValues, statByStar, STAR_DAMAGE_MULTIPLIERS, STAR_HEALTH_MULTIPLIERS } from './unitStats.js'

test('scales health and attack damage by star level', () => {
  // Ahri: 850 HP, 40 AD (client data: AutoAttackDamage 40/60/90).
  assert.deepEqual(statByStar(850, STAR_HEALTH_MULTIPLIERS), [850, 1530, 2754])
  assert.deepEqual(statByStar(40, STAR_DAMAGE_MULTIPLIERS), [40, 60, 90])
  // Caitlyn's 3★ AD is 112.5 in the client — shown rounded half-up.
  assert.deepEqual(statByStar(50, STAR_DAMAGE_MULTIPLIERS), [50, 75, 113])
})

test('missing stats stay missing', () => {
  assert.equal(statByStar(null, STAR_HEALTH_MULTIPLIERS), null)
  assert.equal(formatStarValues(null), '–')
})

test('formats star values, collapsing equal ones', () => {
  assert.equal(formatStarValues([850, 1530, 2754]), '850 / 1530 / 2754')
  assert.equal(formatStarValues([4, 4, 4]), '4')
})
