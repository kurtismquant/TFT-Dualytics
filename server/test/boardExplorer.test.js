import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildBoardIndex,
  exploreBoards,
  MIN_BREAKDOWN_GAMES,
  parseExplorerQuery,
} from '../services/boardExplorer.js'

const IE = 'DA_InfinityEdge'
const GS = 'DA_GiantSlayer'
const AHRI = 'DA_18_Ahri'
const SETT = 'DA_18_Sett'
const KENNEN = 'DA_18_Kennen'
const BLOSSOM = 'DA_18_Blossom'

const unit = (id, tier = 2, itemNames = []) => ({ character_id: id, tier, itemNames })
const trait = (name, tier) => ({ name, tier_current: tier, num_units: 2 })
const participant = (placement, units, traits = []) => ({ placement, units, traits })
const match = (participants, type = 'pairs') => ({ info: { tft_game_type: type, participants } })

// n boards in separate matches, all with the same raw placement.
const boards = (n, placement, units, traits) =>
  Array.from({ length: n }, () => match([participant(placement, units, traits)]))

describe('buildBoardIndex', () => {
  it('normalizes boards like the stats tables', () => {
    const index = buildBoardIndex([
      match([
        participant(3, [
          unit(AHRI, 1, [IE, 'TFT_Item_EmptyBag']),
          unit(AHRI, 2, [GS]),
          unit('DA_18_EliseSpider', 1),
        ], [trait(BLOSSOM, 2), trait('DA_18_Brawler', 0)]),
      ]),
      match([participant(1, [unit(SETT)])], 'standard'),
    ])
    assert.deepEqual(index, [{
      place: 2,
      // Two Ahri copies merge (best star, items of both); aliases map to the real unit.
      units: [{ id: AHRI, star: 2, items: [IE, GS] }, { id: 'DA_18_Elise', star: 1, items: [] }],
      traits: [{ id: BLOSSOM, tier: 2 }],
    }])
  })
})

describe('exploreBoards', () => {
  // 10 boards: Ahri 3★ with IE + Sett, Blossom 2, team 1st.
  // 10 boards: Ahri 2★ with GS + Kennen, Blossom 1, team 3rd.
  // 5 boards: Sett alone, team 4th.
  const index = buildBoardIndex([
    ...boards(10, 1, [unit(AHRI, 3, [IE]), unit(SETT)], [trait(BLOSSOM, 2)]),
    ...boards(10, 5, [unit(AHRI, 2, [GS]), unit(KENNEN)], [trait(BLOSSOM, 1)]),
    ...boards(5, 7, [unit(SETT)]),
  ])
  const none = { units: [], traits: [], items: [] }

  it('summarizes boards matching every filter', () => {
    const result = exploreBoards(index, { ...none, units: [{ id: AHRI }] })
    assert.equal(result.totalBoards, 25)
    assert.equal(result.boards, 20)
    assert.equal(result.avgPlacement, 2)
    assert.equal(result.winRate, 0.5)
    assert.equal(result.top2Rate, 0.5)
    assert.deepEqual(result.placements, [10, 0, 10, 0])
  })

  it('applies star range, required items, trait tier and board items', () => {
    const stars = exploreBoards(index, { ...none, units: [{ id: AHRI, minStar: 3, maxStar: 3 }] })
    assert.equal(stars.boards, 10)
    assert.equal(exploreBoards(index, { ...none, units: [{ id: AHRI, items: [GS] }] }).boards, 10)
    assert.equal(exploreBoards(index, { ...none, traits: [{ id: BLOSSOM, minTier: 2 }] }).boards, 10)
    assert.equal(exploreBoards(index, { ...none, items: [IE], units: [{ id: KENNEN }] }).boards, 0)
  })

  it('breaks down what matching boards run, minus the filters, with deltas', () => {
    const result = exploreBoards(index, { ...none, units: [{ id: AHRI }] })
    assert.equal(MIN_BREAKDOWN_GAMES, 10)
    assert.deepEqual(result.units, [
      { id: SETT, count: 10, frequency: 0.5, avgPlacement: 1, winRate: 1, top2Rate: 1, delta: -1 },
      { id: KENNEN, count: 10, frequency: 0.5, avgPlacement: 3, winRate: 0, top2Rate: 0, delta: 1 },
    ])
    assert.deepEqual(result.items.map(r => r.id), [IE, GS])
    assert.deepEqual(result.traits.map(r => [r.id, r.tier]), [[BLOSSOM, 2], [BLOSSOM, 1]])
    // Filtered traits are left out of the trait breakdown.
    const byTrait = exploreBoards(index, { ...none, traits: [{ id: BLOSSOM }] })
    assert.deepEqual(byTrait.traits, [])
  })

  it('drops breakdown rows below the games floor and handles no matches', () => {
    const few = exploreBoards(index, { ...none, units: [{ id: SETT }] })
    assert.deepEqual(few.units.map(r => r.id), [AHRI]) // 10 boards; nothing else reaches 10
    const empty = exploreBoards(index, { ...none, units: [{ id: 'DA_18_Nobody' }] })
    assert.deepEqual(
      { boards: empty.boards, avg: empty.avgPlacement, units: empty.units },
      { boards: 0, avg: null, units: [] },
    )
  })
})

describe('parseExplorerQuery', () => {
  it('parses the URL filter format', () => {
    assert.deepEqual(parseExplorerQuery({
      units: `${AHRI}:2-3:${IE}+${GS},${SETT}`,
      traits: `${BLOSSOM}:2`,
      items: IE,
    }), {
      units: [{ id: AHRI, minStar: 2, maxStar: 3, items: [IE, GS] }, { id: SETT }],
      traits: [{ id: BLOSSOM, minTier: 2 }],
      items: [IE],
    })
    assert.deepEqual(parseExplorerQuery({}), { units: [], traits: [], items: [] })
  })

  it('rejects bad ids and too many filters', () => {
    assert.throws(() => parseExplorerQuery({ units: 'DA_18_Ahri;drop' }), err => err.status === 400)
    assert.throws(() => parseExplorerQuery({ items: Array(7).fill(IE).join(',') }), err => err.status === 400)
  })
})
