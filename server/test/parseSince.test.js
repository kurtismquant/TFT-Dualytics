import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseSince } from '../routes/summoner.js'

describe('parseSince', () => {
  it('returns null for absent/empty input (full load)', () => {
    assert.equal(parseSince(undefined), null)
    assert.equal(parseSince(null), null)
    assert.equal(parseSince(''), null)
  })

  it('returns null for non-numeric or non-positive input', () => {
    assert.equal(parseSince('abc'), null)
    assert.equal(parseSince('0'), null)
    assert.equal(parseSince('-5'), null)
    assert.equal(parseSince('NaN'), null)
  })

  it('parses and floors a valid positive timestamp', () => {
    assert.equal(parseSince('1700000000000'), 1700000000000)
    assert.equal(parseSince('1700000000000.9'), 1700000000000)
  })
})
