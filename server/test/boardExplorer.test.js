import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { aggregateCompsWithAliases } from '../services/compsAggregator.js'
import {
  buildBoardIndex,
  exploreBoards,
  exploreCurrentPatch,
  MIN_BREAKDOWN_GAMES,
  lookupPlayed,
  MAX_PLAYED_QUERIES,
  parseExplorerQuery,
  parsePartnersQuery,
  parsePlayedQuery,
  partnersOnCurrentPatch,
  playedOnCurrentPatch,
  setBoardIndex,
  tallyExactBoards,
  unitPartners,
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
      comp: `${AHRI}|${AHRI}|DA_18_Elise`,
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

  it('breaks down items per unit, filtered units included', () => {
    const result = exploreBoards(index, { ...none, units: [{ id: AHRI }] })
    // Ahri is in all 20 matching boards (avg 2): IE on half (1st), GS on half (3rd).
    assert.deepEqual(result.unitItems, [
      { unit: AHRI, id: IE, count: 10, frequency: 0.5, avgPlacement: 1, winRate: 1, top2Rate: 1, delta: -1, unitCount: 20 },
      { unit: AHRI, id: GS, count: 10, frequency: 0.5, avgPlacement: 3, winRate: 0, top2Rate: 0, delta: 1, unitCount: 20 },
    ])
  })

  it('groups matching boards by comp, merged comps included', () => {
    const docs = [
      ...boards(10, 1, [unit(AHRI, 3, [IE]), unit(SETT)], [trait(BLOSSOM, 2)]),
      ...boards(10, 5, [unit(AHRI, 2, [GS]), unit(KENNEN)], [trait(BLOSSOM, 1)]),
    ]
    const { comps, aliases } = aggregateCompsWithAliases(docs)
    const result = exploreBoards(buildBoardIndex(docs, aliases), { ...none, units: [{ id: AHRI }] }, comps)
    assert.deepEqual(result.comps.map(({ id, count, avgPlacement, delta }) => ({ id, count, avgPlacement, delta })), [
      { id: `${AHRI}|${SETT}`, count: 10, avgPlacement: 1, delta: -1 },
      { id: `${AHRI}|${KENNEN}`, count: 10, avgPlacement: 3, delta: 1 },
    ])
    assert.deepEqual(result.comps[0].units.map(u => u.id), [AHRI, SETT])
    assert.deepEqual(result.comps[0].traits.map(t => t.id), [BLOSSOM])
    // Without comp results there is nothing to show comps with.
    assert.deepEqual(exploreBoards(buildBoardIndex(docs, aliases), none).comps, [])
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

describe('exploreCurrentPatch', () => {
  it('reports the patch game count for comp play rates', () => {
    const docs = boards(10, 1, [unit(AHRI), unit(SETT)])
    const { comps, aliases } = aggregateCompsWithAliases(docs)
    setBoardIndex('18.3', buildBoardIndex(docs, aliases), comps, docs.length)
    const result = exploreCurrentPatch({ units: AHRI })
    assert.equal(result.totalGames, 10)
    assert.equal(result.comps[0].count, 10)
  })
})

describe('unit partners (Team Builder gold names)', () => {
  // Ahri + Sett on 12 boards, Ahri + Kennen on 8, Ahri + Sett + Kennen on 0.
  const index = buildBoardIndex([
    ...boards(12, 1, [unit(AHRI), unit(SETT)]),
    ...boards(8, 5, [unit(AHRI), unit(KENNEN)]),
    ...boards(10, 3, [unit('DA_Lux18_Base'), unit(SETT)]),
  ])

  it('rates each other unit by its share of boards running all given units', () => {
    // Kennen is on 8 Ahri boards: below the 10-board floor, so left out.
    assert.deepEqual(unitPartners(index, [AHRI]), {
      boards: 20,
      minGames: MIN_BREAKDOWN_GAMES,
      units: [{ id: SETT, count: 12, frequency: 0.6 }],
    })
    assert.deepEqual(unitPartners(index, [SETT]).units, [
      { id: AHRI, count: 12, frequency: 0.5455 },
      { id: 'DA_Lux18_Base', count: 10, frequency: 0.4545 },
    ])
    assert.deepEqual(unitPartners(index, [AHRI, SETT]), { boards: 12, minGames: MIN_BREAKDOWN_GAMES, units: [] })
    assert.deepEqual(unitPartners(index, [AHRI, SETT, KENNEN]), { boards: 0, minGames: MIN_BREAKDOWN_GAMES, units: [] })
  })

  it('canonicalizes Lux forms and drops repeats', () => {
    assert.deepEqual(parsePartnersQuery({ units: `DA_18_Lux_Coven,${SETT},${SETT}` }), ['DA_Lux18_Base', SETT])
    assert.throws(() => parsePartnersQuery({}), err => err.status === 400)
    assert.throws(() => parsePartnersQuery({ units: 'bad id!' }), /Invalid id/)
  })

  it('answers from the current patch index', () => {
    setBoardIndex('18.2', index, [], 30)
    const result = partnersOnCurrentPatch({ units: 'DA_18_Lux_Fae' })
    assert.deepEqual(result, {
      ready: true,
      patch: '18.2',
      boards: 10,
      minGames: MIN_BREAKDOWN_GAMES,
      units: [{ id: SETT, count: 10, frequency: 1 }],
    })
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

  it('rejects bad ids', () => {
    assert.throws(() => parseExplorerQuery({ units: 'DA_18_Ahri;drop' }), err => err.status === 400)
  })

  it('takes any number of filters, dropping repeated ids', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `DA_Item_${i}`)
    assert.equal(parseExplorerQuery({ items: ids.join(',') }).items.length, 20)
    assert.deepEqual(parseExplorerQuery({ units: `${AHRI}:2-3,${AHRI},${SETT}` }).units, [{ id: AHRI, minStar: 2, maxStar: 3 }, { id: SETT }])
  })
})

describe('exact-board play counts (Bronze for Life star)', () => {
  const board = (place, ...ids) => ({ place, units: ids.map(id => ({ id, star: 1, items: [] })), traits: [] })
  const boards = [
    board(1, 'DA_18_Xayah', 'DA_18_Rakan'),
    board(3, 'DA_18_Rakan', 'DA_18_Xayah'), // same team, other order
    board(2, 'DA_18_Xayah', 'DA_18_Rakan', 'DA_Lux18_Base'),
  ]

  it('counts boards with exactly the given units, ignoring order', () => {
    const tally = tallyExactBoards(boards)
    assert.deepEqual(lookupPlayed(tally, [['DA_18_Rakan', 'DA_18_Xayah'], ['DA_18_Xayah'], ['DA_18_Xayah', 'DA_18_Rakan', 'DA_Lux18_Base']]), [
      { count: 2, avgPlacement: 2 },
      { count: 0, avgPlacement: null },
      { count: 1, avgPlacement: 2 },
    ])
  })

  it('canonicalizes Lux forms like board units and drops duplicate ids', () => {
    assert.deepEqual(parsePlayedQuery({ boards: [['DA_18_Lux_Coven', 'DA_18_Xayah', 'DA_18_Xayah']] }), [['DA_Lux18_Base', 'DA_18_Xayah']])
  })

  it('rejects malformed or oversized queries', () => {
    assert.throws(() => parsePlayedQuery({}), /boards must be/)
    assert.throws(() => parsePlayedQuery({ boards: Array.from({ length: MAX_PLAYED_QUERIES + 1 }, () => ['DA_18_Xayah']) }), /at most/)
    assert.throws(() => parsePlayedQuery({ boards: [[]] }), /unit ids/)
    assert.throws(() => parsePlayedQuery({ boards: [['bad id!']] }), /Invalid id/)
  })

  it('answers from the current patch index', () => {
    setBoardIndex('18.1', boards, [], 3)
    const result = playedOnCurrentPatch({ boards: [['DA_18_Xayah', 'DA_18_Rakan', 'DA_18_Lux_Fae']] })
    assert.equal(result.ready, true)
    assert.equal(result.totalBoards, 3)
    assert.deepEqual(result.results, [{ count: 1, avgPlacement: 2 }])
  })
})
