// Run with: node --test client/src/utils/estimateMatchLp.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateMatchLp, priorsForTier, tierFloorOf } from './estimateMatchLp.js'
import { lpFromRank, APEX_LP_BASE } from './lpFromRank.js'

const snap = (ms, tier, rank, lp) => ({
  recordedAt: new Date(ms).toISOString(),
  tier,
  rank,
  leaguePoints: lp,
})

const match = (matchId, ms, teamPlacement) => ({ matchId, date: ms, teamPlacement })
const find = (points, id) => points.find(p => p.matchId === id)

// The first 5 games of a set are placements (provisional). Most behaviors below
// must be tested on NON-provisional matches, so prefix 5 early filler placements.
const fillers = (startTs = 10, step = 10) =>
  Array.from({ length: 5 }, (_, i) => match(`fill${i}`, startTs + i * step, (i % 4) + 1))

const DAY = 24 * 60 * 60 * 1000

test('returns [] when no snapshots / no matches', () => {
  assert.deepEqual(estimateMatchLp([], [match('m1', 1000, 1)]), [])
  assert.deepEqual(estimateMatchLp([snap(1000, 'GOLD', 'IV', 0)], []), [])
})

test('zero matches in a window emits nothing for that window', () => {
  const A = snap(1000, 'GOLD', 'I', 50)
  const B = snap(2000, 'PLATINUM', 'IV', 10)
  assert.deepEqual(estimateMatchLp([A, B], []), [])
})

test('window matches: snap-to-truth + sum of gains equals real delta', () => {
  // A: Plat IV 0. B: Plat IV 60. Delta = +60, over four non-provisional games.
  const A = snap(1000, 'PLATINUM', 'IV', 0)
  const B = snap(2000, 'PLATINUM', 'IV', 60)
  const matches = [
    ...fillers(),
    match('m1', 1100, 1),
    match('m2', 1300, 4),
    match('m3', 1500, 2),
    match('m4', 1900, 3),
  ]
  const points = estimateMatchLp([A, B], matches)
  const seg = ['m1', 'm2', 'm3', 'm4'].map(id => find(points, id))
  // Last match in the window snaps exactly to snapshot B
  assert.equal(seg[3].absLp, lpFromRank(B))
  // Sum of the window's per-match deltas equals the real LP delta (60)
  const sum = seg.reduce((s, p) => s + p.delta, 0)
  assert.equal(Math.round(sum), 60)
  // Sign rule holds: the win is >= 0, the loss is <= 0
  assert.ok(seg[0].delta >= 0)
  assert.ok(seg[1].delta <= 0)
})

test('estimated tier/rank/lp are populated from rankFromLp', () => {
  const A = snap(1000, 'PLATINUM', 'IV', 0)
  const B = snap(2000, 'PLATINUM', 'III', 0)
  const points = estimateMatchLp([A, B], [
    ...fillers(),
    match('m1', 1500, 1),
    match('m2', 1800, 2),
  ])
  for (const p of points) {
    assert.ok(p.tier, 'tier populated')
    assert.equal(typeof p.leaguePoints, 'number')
  }
})

test('provisional placement games: never lose LP, climb from the Iron II–Silver IV band', () => {
  const matches = [
    match('p1', 100, 1),
    match('p2', 200, 4),
    match('p3', 300, 1),
    match('p4', 400, 4),
    match('p5', 500, 1),
  ]
  const first = snap(600, 'GOLD', 'IV', 0) // post-placement rank
  const points = estimateMatchLp([first], matches)
  assert.equal(points.length, 5)
  // No placement game ever loses LP — even the 4th-place games.
  for (const p of points) assert.ok(p.delta >= 0, `placement delta >= 0, got ${p.delta}`)
  // Cumulative LP is monotonic non-decreasing through placements.
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].absLp >= points[i - 1].absLp, 'placements never go down')
  }
  // Season start (LP before game 1) sits in the Iron II–Silver IV band.
  const s0 = points[0].absLp - points[0].delta
  assert.ok(s0 >= 200 && s0 <= 800, `start ${s0} within [200, 800]`)
})

test('start-band invariant: season start is always Iron II–Silver IV across tiers', () => {
  const placements = [
    match('p1', 100, 1),
    match('p2', 200, 1),
    match('p3', 300, 1),
    match('p4', 400, 1),
    match('p5', 500, 1),
  ]
  const cases = [
    snap(600, 'IRON', 'IV', 0),
    snap(600, 'GOLD', 'II', 0),
    snap(600, 'DIAMOND', 'I', 0),
    snap(600, 'MASTER', null, 200),
  ]
  for (const first of cases) {
    const points = estimateMatchLp([first], placements)
    const s0 = points[0].absLp - points[0].delta
    assert.ok(s0 >= 200 && s0 <= 800, `${first.tier}: start ${s0} within [200, 800]`)
  }
})

test('provisional games are excluded from rate calibration', () => {
  // Placement games imply a huge +200/win, but a real later window implies a
  // modest win rate. The post-snapshot win must reflect the modest rate.
  const matches = [
    match('p1', 100, 1),
    match('p2', 200, 1),
    match('p3', 300, 1), // falls inside the A->B provisional window
    match('p4', 400, 1), // falls inside the A->B provisional window
    match('p5', 500, 1),
    match('real', 2000, 1), // non-provisional, inside C->D
    match('post', 3000, 1),
  ]
  const snaps = [
    snap(250, 'BRONZE', 'IV', 0), // 400
    snap(450, 'SILVER', 'IV', 0), // 800  -> +400 across 2 placement wins (must be ignored)
    snap(1500, 'SILVER', 'IV', 0), // 800
    snap(2500, 'SILVER', 'IV', 40), // 840 -> modest +40 across 1 real win
  ]
  const points = estimateMatchLp(snaps, matches)
  const post = find(points, 'post')
  assert.ok(post.delta < 100, `learned win rate stays sane, got ${post.delta}`)
})

test('apex decay is treated as gap drift, not a game result', () => {
  // Master, net LP DROPS (-100) over the window because of decay, yet the games
  // were wins. With decay separated, the win keeps a clearly positive delta.
  const t0 = 1_000_000_000
  const A = snap(t0, 'MASTER', null, 200) // 3000
  const B = snap(t0 + 25 * DAY, 'MASTER', null, 100) // 2900, net -100
  const matches = [
    ...fillers(),
    match('w1', t0 + 1 * DAY, 1),
    match('w2', t0 + 21 * DAY, 1), // 20-day inactive gap before it -> decay
  ]
  const points = estimateMatchLp([A, B], matches)
  const w1 = find(points, 'w1')
  const w2 = find(points, 'w2')
  assert.ok(w1.delta > 10, `win stays positive despite net LP loss, got ${w1.delta}`)
  assert.ok(w1.absLp >= APEX_LP_BASE, 'never below the Master floor')
  assert.ok(w2.absLp >= APEX_LP_BASE, 'never below the Master floor')
  assert.equal(w2.absLp, lpFromRank(B), 'snap-to-truth holds')
})

test('hard sign rule: wins never show a loss, losses never show a gain', () => {
  // Big positive delta with two 4th-place games — naive distribution would make
  // the 4ths gain LP. The sign rule forbids it.
  const A = snap(1000, 'GOLD', 'IV', 0) // 1200
  const B = snap(2000, 'GOLD', 'III', 80) // 1380, +180
  const matches = [
    ...fillers(),
    match('L1', 1100, 4),
    match('L2', 1300, 4),
    match('W1', 1500, 1),
    match('W2', 1900, 1),
  ]
  const points = estimateMatchLp([A, B], matches)
  const seg = ['L1', 'L2', 'W1', 'W2'].map(id => find(points, id))
  for (const p of seg) {
    if (p.teamPlacement <= 2) assert.ok(p.delta >= 0, `win >= 0, got ${p.delta}`)
    else assert.ok(p.delta <= 0, `loss <= 0, got ${p.delta}`)
  }
  assert.equal(Math.round(seg.reduce((s, p) => s + p.delta, 0)), 180)
})

test('demotion floor: losses at a tier floor stay clamped, deltas are 0', () => {
  const last = snap(1000, 'SILVER', 'IV', 0) // 800 = a tier floor
  const floor = tierFloorOf(lpFromRank(last))
  const matches = [
    ...fillers(),
    match('l1', 1500, 4),
    match('l2', 2000, 3),
    match('l3', 2500, 4),
  ]
  const points = estimateMatchLp([last], matches)
  for (const id of ['l1', 'l2', 'l3']) {
    const p = find(points, id)
    assert.equal(p.absLp, floor, 'clamped exactly at the floor')
    assert.equal(p.delta, 0, 'no LP lost at the floor')
  }
})

test('phantom-floor guard: over-shot gains are not shielded at an un-earned floor', () => {
  const last = snap(1000, 'GOLD', 'I', 75) // 1575; confirmed floor = Gold IV 1200
  const goldFloor = tierFloorOf(lpFromRank(last))
  const matches = [...fillers(), match('win', 1100, 1)]
  for (let i = 0; i < 12; i++) matches.push(match(`loss${i}`, 1200 + i * 100, 4))
  const points = estimateMatchLp([last], matches)
  const trailing = points.filter(p => p.matchId === 'win' || p.matchId.startsWith('loss'))
  const maxAbs = Math.max(...trailing.map(p => p.absLp))
  const minAbs = Math.min(...trailing.map(p => p.absLp))
  assert.ok(maxAbs > 1600, `win over-shoots into Platinum, peak ${maxAbs}`)
  assert.ok(
    trailing.some(p => p.absLp > goldFloor && p.absLp < 1600),
    'falls back through the Platinum boundary (not shielded at 1600)',
  )
  assert.ok(minAbs >= goldFloor, `never below the confirmed Gold floor ${goldFloor}`)
  assert.equal(trailing[trailing.length - 1].absLp, goldFloor, 'bottoms out at the Gold floor')
})

test('calibration learns asymmetric rates from an MMR-ahead climber', () => {
  // 1st-place windows gain +70, 4th-place windows lose only -15. All snapshots
  // mid-Platinum (no tier floor). Provisional games are prefixed and ignored.
  const snaps = [
    snap(1000, 'PLATINUM', 'IV', 50),
    snap(2000, 'PLATINUM', 'III', 20),
    snap(3000, 'PLATINUM', 'III', 5),
    snap(4000, 'PLATINUM', 'III', 75),
    snap(5000, 'PLATINUM', 'III', 60),
    snap(6000, 'PLATINUM', 'II', 30),
    snap(7000, 'PLATINUM', 'II', 15),
  ]
  const matches = [
    ...fillers(),
    match('w1', 1500, 1),
    match('w2', 2500, 4),
    match('w3', 3500, 1),
    match('w4', 4500, 4),
    match('w5', 5500, 1),
    match('w6', 6500, 4),
    match('post1', 7500, 1),
    match('post4', 7600, 4),
  ]
  const prior = priorsForTier(lpFromRank(snaps[snaps.length - 1]))
  const points = estimateMatchLp(snaps, matches)
  const post1 = find(points, 'post1')
  const post4 = find(points, 'post4')
  assert.ok(post1.delta > prior[1], `learned 1st (${post1.delta}) > prior (${prior[1]})`)
  assert.ok(post4.delta > prior[4], `learned 4th (${post4.delta}) > prior (${prior[4]})`)
})

test('floor-aware calibration: clamped-loss window does not zero out loss rate', () => {
  const snaps = [
    snap(1000, 'SILVER', 'I', 90), // 1190
    snap(2000, 'SILVER', 'I', 50), // 1150  (-40, 4th)
    snap(3000, 'SILVER', 'I', 10), // 1110  (-40, 4th)
    snap(4000, 'SILVER', 'II', 70), // 1070 (-40, 4th)
    snap(4500, 'SILVER', 'IV', 0), // 800   bottomed out
    snap(5500, 'SILVER', 'IV', 0), // 800   floor window: 4ths but delta 0
    snap(6500, 'SILVER', 'III', 50), // 950 climbed back out
  ]
  const matches = [
    ...fillers(),
    match('a', 1500, 4),
    match('b', 2500, 4),
    match('c', 3500, 4),
    match('f1', 4700, 4),
    match('f2', 5000, 4),
    match('f3', 5300, 4),
    match('rec', 6000, 1),
    match('post4', 7000, 4),
  ]
  const points = estimateMatchLp(snaps, matches)
  const post4 = find(points, 'post4')
  assert.ok(post4.delta < -25, `4th loss stays realistic, got ${post4.delta}`)
})
