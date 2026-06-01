// Run with: node --test client/src/utils/estimateMatchLp.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateMatchLp, priorsForTier, tierFloorOf } from './estimateMatchLp.js'
import { lpFromRank } from './lpFromRank.js'

const snap = (ms, tier, rank, lp) => ({
  recordedAt: new Date(ms).toISOString(),
  tier,
  rank,
  leaguePoints: lp,
})

const match = (matchId, ms, teamPlacement) => ({ matchId, date: ms, teamPlacement })

test('window matches: snap-to-truth + sum of gains equals real delta', () => {
  // Snapshot A: Plat IV 0 LP. Snapshot B: Plat IV 60 LP. Delta = +60.
  const A = snap(1000, 'PLATINUM', 'IV', 0)
  const B = snap(2000, 'PLATINUM', 'IV', 60)
  const matches = [
    match('m1', 1100, 1), // win
    match('m2', 1300, 4), // big loss
    match('m3', 1500, 2), // small win
    match('m4', 1900, 3), // small loss
  ]
  const points = estimateMatchLp([A, B], matches)
  assert.equal(points.length, 4)
  // Last match snaps exactly to snapshot B
  assert.equal(points[points.length - 1].absLp, lpFromRank(B))
  // Sum of per-match deltas equals real LP delta (60)
  const sum = points.reduce((s, p) => s + p.delta, 0)
  assert.equal(Math.round(sum), 60)
  // First match (a 1st-place win) should gain more than the 4th-place loss
  assert.ok(points[0].delta > points[1].delta, '1st should gain more than 4th in same window')
})

test('zero matches in window: emits nothing for that window', () => {
  const A = snap(1000, 'GOLD', 'I', 50)
  const B = snap(2000, 'PLATINUM', 'IV', 10)
  const points = estimateMatchLp([A, B], [])
  assert.deepEqual(points, [])
})

test('single snapshot falls back to tier-scaled priors (pre-snapshot, walking back)', () => {
  const first = snap(2000, 'GOLD', 'IV', 100)
  const prior = priorsForTier(lpFromRank(first))
  const matches = [
    match('m1', 1000, 1), // 1st
    match('m2', 1500, 4), // 4th
  ]
  const points = estimateMatchLp([first], matches)
  assert.equal(points.length, 2)
  // m2 (the last pre-match) lands on first.absLp
  assert.equal(points[1].absLp, lpFromRank(first))
  // m2's delta is the calibrated (prior) 4th-place rate
  assert.equal(points[1].delta, prior[4])
  // Walking backward: m1.lp = firstAbs - m2.delta
  assert.equal(points[0].absLp, lpFromRank(first) - prior[4])
})

test('single snapshot falls back to tier-scaled priors (post-snapshot, walking forward)', () => {
  const last = snap(1000, 'GOLD', 'IV', 100)
  const prior = priorsForTier(lpFromRank(last))
  const matches = [
    match('m1', 1500, 1), // 1st gain
    match('m2', 2000, 3), // 3rd loss
  ]
  const points = estimateMatchLp([last], matches)
  assert.equal(points.length, 2)
  assert.equal(points[0].absLp, lpFromRank(last) + prior[1])
  assert.equal(points[1].absLp, lpFromRank(last) + prior[1] + prior[3])
})

test('returns [] when no snapshots are present', () => {
  const matches = [match('m1', 1000, 1)]
  assert.deepEqual(estimateMatchLp([], matches), [])
})

test('estimated tier/rank/lp are populated from rankFromLp', () => {
  const A = snap(1000, 'PLATINUM', 'IV', 0)
  const B = snap(2000, 'PLATINUM', 'III', 0) // +100 LP
  const points = estimateMatchLp([A, B], [
    match('m1', 1500, 1),
    match('m2', 1800, 2),
  ])
  for (const p of points) {
    assert.ok(p.tier, 'tier populated')
    assert.ok(p.rank, 'rank populated')
    assert.equal(typeof p.leaguePoints, 'number')
  }
})

test('calibration learns asymmetric rates from MMR-ahead climber', () => {
  // Six windows, each with one match: 1st-place windows gain +70, 4th-place
  // windows lose only -15 (hidden MMR well above visible rank). All snapshots
  // are mid-Platinum so none sit on a tier floor.
  const snaps = [
    snap(1000, 'PLATINUM', 'IV', 50), // 1650
    snap(2000, 'PLATINUM', 'III', 20), // 1720  (+70 over m at 1st)
    snap(3000, 'PLATINUM', 'III', 5), // 1705  (-15 over m at 4th)
    snap(4000, 'PLATINUM', 'III', 75), // 1775  (+70)
    snap(5000, 'PLATINUM', 'III', 60), // 1760  (-15)
    snap(6000, 'PLATINUM', 'II', 30), // 1830  (+70)
    snap(7000, 'PLATINUM', 'II', 15), // 1815  (-15)
  ]
  const matches = [
    match('w1', 1500, 1),
    match('w2', 2500, 4),
    match('w3', 3500, 1),
    match('w4', 4500, 4),
    match('w5', 5500, 1),
    match('w6', 6500, 4),
    // A post-snapshot game so we can read the learned rate off the output.
    match('post1', 7500, 1),
    match('post4', 7600, 4),
  ]
  const prior = priorsForTier(lpFromRank(snaps[snaps.length - 1]))
  const points = estimateMatchLp(snaps, matches)
  const post1 = points.find(p => p.matchId === 'post1')
  const post4 = points.find(p => p.matchId === 'post4')
  // 1st-place gain shifts up toward +70; 4th-place loss shifts up toward -15
  // (smaller magnitude) — both moving away from the prior in the right direction.
  assert.ok(post1.delta > prior[1], `learned 1st (${post1.delta}) > prior (${prior[1]})`)
  assert.ok(post4.delta > prior[4], `learned 4th (${post4.delta}) > prior (${prior[4]})`)
})

test('sparse data degrades gracefully toward priors', () => {
  // One low-signal window — learned rates should stay close to the prior.
  const A = snap(1000, 'PLATINUM', 'II', 50) // 1850
  const B = snap(2000, 'PLATINUM', 'II', 55) // 1855, +5 total
  const matches = [
    match('m1', 1200, 1),
    match('m2', 1400, 4),
    match('post', 2500, 1),
  ]
  const prior = priorsForTier(lpFromRank(B))
  const points = estimateMatchLp([A, B], matches)
  const post = points.find(p => p.matchId === 'post')
  assert.ok(Math.abs(post.delta - prior[1]) < 20, 'learned 1st stays near prior')
})

test('monotonic/clamp guard: 4th place never gains in unanchored region', () => {
  // A pathological window where a 4th place coincided with a big LP gain.
  const A = snap(1000, 'PLATINUM', 'II', 10) // 1810
  const B = snap(2000, 'PLATINUM', 'II', 90) // 1890, +80 with a single 4th
  const matches = [
    match('m4', 1500, 4),
    match('post4', 2500, 4), // post-snapshot 4th place
  ]
  const points = estimateMatchLp([A, B], matches)
  const post4 = points.find(p => p.matchId === 'post4')
  assert.ok(post4.delta < 0, `4th place must lose LP, got ${post4.delta}`)
})

test('demotion floor: losses at a tier floor stay clamped, deltas are 0', () => {
  // Silver IV 0 LP = absLp 800 (a tier floor).
  const last = snap(1000, 'SILVER', 'IV', 0)
  const floor = tierFloorOf(lpFromRank(last)) // 800
  const matches = [
    match('l1', 1500, 4),
    match('l2', 2000, 3),
    match('l3', 2500, 4),
  ]
  const points = estimateMatchLp([last], matches)
  for (const p of points) {
    assert.ok(p.absLp >= floor, `never below floor ${floor}, got ${p.absLp}`)
    assert.equal(p.absLp, floor, 'clamped exactly at the floor')
    assert.equal(p.delta, 0, 'no LP lost at the floor')
  }
})

test('floor-aware calibration: clamped-loss window does not zero out loss rate', () => {
  // Three normal Silver windows imply ~ -40 per 4th place. Then the player bottoms
  // out on the Silver IV floor (800) and plays three more 4ths there with a 0 LP
  // delta (clamped), before climbing back out. That floor window is down-weighted,
  // so the learned 4th-place rate (read off a post-snapshot 4th played above the
  // floor) must stay a realistic loss rather than being dragged toward zero.
  const snaps = [
    snap(1000, 'SILVER', 'I', 90), // 1190
    snap(2000, 'SILVER', 'I', 50), // 1150  (-40, 4th)
    snap(3000, 'SILVER', 'I', 10), // 1110  (-40, 4th)
    snap(4000, 'SILVER', 'II', 70), // 1070 (-40, 4th)
    snap(4500, 'SILVER', 'IV', 0), // 800   bottomed out (no match attributed)
    snap(5500, 'SILVER', 'IV', 0), // 800   floor window: 4ths but delta 0
    snap(6500, 'SILVER', 'III', 50), // 950 climbed back out (post game sits here)
  ]
  const matches = [
    match('a', 1500, 4),
    match('b', 2500, 4),
    match('c', 3500, 4),
    // floor window: several 4ths but LP delta is 0 (clamped at the floor)
    match('f1', 4700, 4),
    match('f2', 5000, 4),
    match('f3', 5300, 4),
    match('rec', 6000, 1), // climb back out of the floor
    // post-snapshot 4th, played above the floor, reads the learned rate
    match('post4', 7000, 4),
  ]
  const points = estimateMatchLp(snaps, matches)
  const post4 = points.find(p => p.matchId === 'post4')
  assert.ok(post4.delta < -25, `4th loss stays realistic, got ${post4.delta}`)
})

test('phantom-floor guard: over-shot gains are not shielded at an un-earned floor', () => {
  // Last confirmed snapshot is Gold I 75 LP (absLp 1575); the confirmed floor is
  // Gold IV (1200). A win over-shoots into Platinum (>1600), then a long losing
  // streak must fall back THROUGH the Plat boundary down to the Gold floor — it
  // must not be shielded at the un-earned Plat floor (1600).
  const last = snap(1000, 'GOLD', 'I', 75) // 1575
  const goldFloor = tierFloorOf(lpFromRank(last)) // 1200
  const matches = [match('win', 1100, 1)]
  for (let i = 0; i < 12; i++) matches.push(match(`loss${i}`, 1200 + i * 100, 4))
  const points = estimateMatchLp([last], matches)

  const maxAbs = Math.max(...points.map(p => p.absLp))
  const minAbs = Math.min(...points.map(p => p.absLp))
  assert.ok(maxAbs > 1600, `win over-shoots into Platinum, peak ${maxAbs}`)
  assert.ok(
    points.some(p => p.absLp > goldFloor && p.absLp < 1600),
    'line falls back through the Platinum boundary (not shielded at 1600)',
  )
  assert.ok(minAbs >= goldFloor, `never falls below the confirmed Gold floor ${goldFloor}`)
  assert.equal(points[points.length - 1].absLp, goldFloor, 'streak bottoms out at the Gold floor')
})
