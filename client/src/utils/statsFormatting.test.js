import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatDelta } from './statsFormatting.js'

describe('formatDelta', () => {
  it('signs differences and drops the sign when they round to zero', () => {
    assert.equal(formatDelta(-0.1234), '−0.12')
    assert.equal(formatDelta(0.05), '+0.05')
    assert.equal(formatDelta(-0.0029), '0.00')
    assert.equal(formatDelta(0), '0.00')
  })
})
