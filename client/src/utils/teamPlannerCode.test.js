// Run with: node --test client/src/utils/teamPlannerCode.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeTeamPlannerCode } from './teamPlannerCode.js'

// plannerCode values are Set 18's real team_planner_code numbers.
const gromp = { id: 'DA_Gromp18_AP', plannerCode: 1026 }
const luxBase = { id: 'DA_Lux18_Base', plannerCode: 1029 }
const blossomLux = { id: 'DA_Lux18_Blossom', plannerCode: null, formOf: 'DA_Lux18_Base' }
const khazix = { id: 'DA_18_KhaZix', plannerCode: 1036, formOf: 'DA_18_KhaZix' }
const championsById = new Map([gromp, luxBase, blossomLux, khazix].map(c => [c.id, c]))

test('3-digit slots with the 02 prefix, empty slots zero-filled, set suffix', () => {
  assert.equal(encodeTeamPlannerCode([gromp], championsById, 18), `02402${'000'.repeat(9)}TFTSet18`)
})

test('a Lux form is planned as base Lux; a Kha\'Zix variant keeps his code', () => {
  assert.equal(
    encodeTeamPlannerCode([gromp, blossomLux, khazix], championsById, 18),
    `0240240540c${'000'.repeat(7)}TFTSet18`,
  )
})

test('older sets with codes up to 0xFF use the 01 prefix and 2-digit slots', () => {
  assert.equal(encodeTeamPlannerCode([{ plannerCode: 1 }, { plannerCode: 10 }], championsById, 13), `01010a${'00'.repeat(8)}TFTSet13`)
})

test('duplicates collapse; units without a code are skipped; none at all gives null', () => {
  assert.equal(encodeTeamPlannerCode([gromp, gromp], championsById, 18), `02402${'000'.repeat(9)}TFTSet18`)
  assert.equal(encodeTeamPlannerCode([gromp, { id: 'TrainingDummy' }], championsById, 18), `02402${'000'.repeat(9)}TFTSet18`)
  assert.equal(encodeTeamPlannerCode([{ id: 'X' }], championsById, 18), null)
  assert.equal(encodeTeamPlannerCode([], championsById, 18), null)
})

test('more than 10 units keeps the 10 priciest', () => {
  const units = Array.from({ length: 11 }, (_, i) => ({ plannerCode: 1000 + i, cost: i === 0 ? 1 : 3 }))
  const code = encodeTeamPlannerCode(units, championsById, 18)
  assert.ok(!code.includes((1000).toString(16)), 'the 1-cost is dropped')
  assert.equal(code.length, 2 + 30 + 'TFTSet18'.length)
})

test('defaults to the current set', () => {
  assert.match(encodeTeamPlannerCode([gromp]), /TFTSet18$/)
})
