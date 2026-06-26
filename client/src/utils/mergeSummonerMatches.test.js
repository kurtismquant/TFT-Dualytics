// Run with: node --test client/src/utils/mergeSummonerMatches.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSummonerMatches, needsReconcile } from './mergeSummonerMatches.js'

const m = (matchId, date) => ({ matchId, date })

const payload = (matches, overrides = {}) => ({
  summoner: { gameName: 'P', tagLine: 'NA1', puuid: 'p' },
  matches,
  rankInfo: { tier: 'GOLD' },
  rankSnapshots: [],
  participantRanks: {},
  cache: { source: 'mongo', matchCount: matches.length, lastMatchAt: matches[0]?.date ?? null },
  sync: { state: 'idle' },
  ...overrides,
})

test('merges new matches ahead of old, sorted newest-first', () => {
  const prev = payload([m('b', 200), m('a', 100)])
  const res = payload([m('c', 300)], { cache: { matchCount: 3, lastMatchAt: 300 } })
  const out = mergeSummonerMatches(prev, res)
  assert.deepEqual(out.matches.map(x => x.matchId), ['c', 'b', 'a'])
})

test('dedups by matchId, incoming copy wins', () => {
  const prev = payload([m('b', 200), m('a', 100)])
  const res = payload([{ matchId: 'b', date: 200, placement: 1 }], { cache: { matchCount: 2, lastMatchAt: 200 } })
  const out = mergeSummonerMatches(prev, res)
  assert.equal(out.matches.length, 2)
  assert.equal(out.matches.find(x => x.matchId === 'b').placement, 1) // fresher copy kept
})

test('empty incoming keeps prior matches and recomputes lastMatchAt', () => {
  const prev = payload([m('b', 200), m('a', 100)])
  const res = payload([], { cache: { matchCount: 2, lastMatchAt: null } })
  const out = mergeSummonerMatches(prev, res)
  assert.deepEqual(out.matches.map(x => x.matchId), ['b', 'a'])
  assert.equal(out.cache.lastMatchAt, 200) // not the null from the incremental response
})

test('unions participantRanks; authoritative fields come from the response', () => {
  const prev = payload([m('a', 100)], { participantRanks: { x: { tier: 'IRON' } }, rankInfo: { tier: 'OLD' } })
  const res = payload([m('b', 200)], {
    participantRanks: { y: { tier: 'DIAMOND' } },
    rankInfo: { tier: 'NEW' },
    cache: { matchCount: 2, lastMatchAt: 200 },
  })
  const out = mergeSummonerMatches(prev, res)
  assert.deepEqual(out.participantRanks, { x: { tier: 'IRON' }, y: { tier: 'DIAMOND' } })
  assert.equal(out.rankInfo.tier, 'NEW')
  assert.equal(out.cache.matchCount, 2)
})

test('needsReconcile: false while syncing even on count mismatch', () => {
  const merged = { matches: [m('a', 1)], cache: { matchCount: 5 }, sync: { state: 'syncing' } }
  assert.equal(needsReconcile(merged), false)
})

test('needsReconcile: true when settled and merged length < authoritative count', () => {
  const merged = { matches: [m('a', 1)], cache: { matchCount: 3 }, sync: { state: 'complete' } }
  assert.equal(needsReconcile(merged), true)
})

test('needsReconcile: true when settled and client holds a stale (expired) extra match', () => {
  const merged = { matches: [m('a', 1), m('b', 2)], cache: { matchCount: 1 }, sync: { state: 'idle' } }
  assert.equal(needsReconcile(merged), true)
})

test('needsReconcile: false when counts agree, or count is missing', () => {
  assert.equal(needsReconcile({ matches: [m('a', 1)], cache: { matchCount: 1 }, sync: { state: 'idle' } }), false)
  assert.equal(needsReconcile({ matches: [m('a', 1)], cache: {}, sync: { state: 'idle' } }), false)
})
