import { deduplicateUnits } from './unitUtils.js'
import { toTeamPlacement } from './teamPlacement.js'

// Board explorer: "how do boards with these units / traits / items do, and what
// else do they run?" Answered in-process from a compact index of the current
// patch's Double Up boards, rebuilt by the comp aggregation pass from the match
// docs it already pulls — so requests never read raw matches over the slow
// remote Mongo link.

const EMPTY_BAG = 'TFT_Item_EmptyBag'
const ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/
export const MAX_FILTERS = 6
// Breakdown rows need this many matching boards; below it the averages are noise.
export const MIN_BREAKDOWN_GAMES = 10
export const BREAKDOWN_LIMIT = 60
const CACHE_TTL_MS = 60 * 1000

// One board per Double Up participant, normalized like the Stats tables:
// deduplicated/aliased units (unitUtils), team placement 1-4, active traits
// (tier_current > 0), no EmptyBag. A unit fielded twice is merged: its best
// star level and the union of the items both copies hold.
export function buildBoardIndex(matches) {
  const boards = []
  for (const match of matches) {
    const info = match?.info
    if (info?.tft_game_type !== 'pairs') continue
    for (const participant of info.participants || []) {
      const placement = Number(participant.placement)
      if (!Number.isFinite(placement)) continue
      const units = new Map()
      for (const unit of deduplicateUnits(participant.units || [])) {
        const id = unit.character_id
        if (!id) continue
        const star = Math.min(3, Math.max(1, Math.trunc(Number(unit.tier)) || 1))
        const items = (unit.itemNames || []).filter(item => item && item !== EMPTY_BAG)
        const seen = units.get(id)
        if (seen) {
          seen.star = Math.max(seen.star, star)
          seen.items = [...new Set([...seen.items, ...items])]
        } else {
          units.set(id, { id, star, items: [...new Set(items)] })
        }
      }
      const traits = (participant.traits || [])
        .filter(trait => trait.name && Number(trait.tier_current) > 0)
        .map(trait => ({ id: trait.name, tier: Number(trait.tier_current) }))
      boards.push({ place: toTeamPlacement(placement), units: [...units.values()], traits })
    }
  }
  return boards
}

function badRequest(message) {
  const err = new Error(message)
  err.status = 400
  return err
}

function parseId(value) {
  if (!ID_PATTERN.test(value)) throw badRequest(`Invalid id: ${String(value).slice(0, 64)}`)
  return value
}

function splitList(value) {
  if (value == null || value === '') return []
  const list = String(value).split(',').filter(Boolean)
  if (list.length > MAX_FILTERS) throw badRequest(`At most ${MAX_FILTERS} filters of each kind`)
  return list
}

// Query string → filters. Same format the client keeps in its URL:
//   units=DA_18_Ahri:2-3:DA_InfinityEdge+DA_GiantSlayer,DA_18_Sett
//   traits=DA_18_Blossom:2   (minimum tier, tier_current)
//   items=DA_RabadonsDeathcap
export function parseExplorerQuery(query = {}) {
  const units = splitList(query.units).map(entry => {
    const [id, stars = '', items = ''] = entry.split(':')
    const [min, max] = stars.split('-').map(Number)
    const filter = { id: parseId(id) }
    if (Number.isInteger(min) && min >= 1 && min <= 3) filter.minStar = min
    if (Number.isInteger(max) && max >= 1 && max <= 3) filter.maxStar = max
    const required = items.split('+').filter(Boolean)
    if (required.length > 3) throw badRequest('At most 3 items per unit')
    if (required.length) filter.items = required.map(parseId)
    return filter
  })
  const traits = splitList(query.traits).map(entry => {
    const [id, tier] = entry.split(':')
    const filter = { id: parseId(id) }
    const minTier = Number(tier)
    if (Number.isInteger(minTier) && minTier >= 1 && minTier <= 6) filter.minTier = minTier
    return filter
  })
  const items = splitList(query.items).map(parseId)
  return { units, traits, items }
}

export function boardMatches(board, { units, traits, items }) {
  for (const filter of units) {
    const unit = board.units.find(u => u.id === filter.id)
    if (!unit) return false
    if (filter.minStar && unit.star < filter.minStar) return false
    if (filter.maxStar && unit.star > filter.maxStar) return false
    if (filter.items && !filter.items.every(item => unit.items.includes(item))) return false
  }
  for (const filter of traits) {
    const trait = board.traits.find(t => t.id === filter.id)
    if (!trait || trait.tier < (filter.minTier || 1)) return false
  }
  for (const item of items) {
    if (!board.units.some(unit => unit.items.includes(item))) return false
  }
  return true
}

function tally(map, key, place, extra) {
  let row = map.get(key)
  if (!row) {
    row = { ...extra, count: 0, placementTotal: 0, wins: 0, top2: 0 }
    map.set(key, row)
  }
  row.count += 1
  row.placementTotal += place
  if (place === 1) row.wins += 1
  if (place <= 2) row.top2 += 1
}

function finalizeRows(map, total, matchedAvg) {
  return [...map.values()]
    .filter(row => row.count >= MIN_BREAKDOWN_GAMES)
    .map(({ placementTotal, wins, top2, ...row }) => {
      const avgPlacement = placementTotal / row.count
      return {
        ...row,
        frequency: row.count / total,
        avgPlacement,
        winRate: wins / row.count,
        top2Rate: top2 / row.count,
        delta: avgPlacement - matchedAvg,
      }
    })
    .sort((a, b) => b.count - a.count || a.avgPlacement - b.avgPlacement)
    .slice(0, BREAKDOWN_LIMIT)
}

// Pure: index boards + filters → how matching boards place, and the units,
// items and traits they run (minus the filtered ones) with each one's results
// within those boards. `delta` < 0 means boards with it place better than the
// matching boards overall.
export function exploreBoards(boards, filters) {
  const matched = boards.filter(board => boardMatches(board, filters))
  const placements = [0, 0, 0, 0]
  let placementTotal = 0
  for (const board of matched) {
    placements[board.place - 1] += 1
    placementTotal += board.place
  }
  const n = matched.length
  const avgPlacement = n ? placementTotal / n : null

  const unitIds = new Set(filters.units.map(f => f.id))
  const traitIds = new Set(filters.traits.map(f => f.id))
  const itemIds = new Set(filters.items)
  const units = new Map()
  const items = new Map()
  const traits = new Map()
  for (const board of matched) {
    const boardItems = new Set()
    for (const unit of board.units) {
      if (!unitIds.has(unit.id)) tally(units, unit.id, board.place, { id: unit.id })
      for (const item of unit.items) boardItems.add(item)
    }
    for (const item of boardItems) {
      if (!itemIds.has(item)) tally(items, item, board.place, { id: item })
    }
    for (const trait of board.traits) {
      if (!traitIds.has(trait.id)) tally(traits, `${trait.id}#${trait.tier}`, board.place, { id: trait.id, tier: trait.tier })
    }
  }

  return {
    totalBoards: boards.length,
    boards: n,
    avgPlacement,
    winRate: n ? placements[0] / n : null,
    top2Rate: n ? (placements[0] + placements[1]) / n : null,
    placements,
    minGames: MIN_BREAKDOWN_GAMES,
    units: n ? finalizeRows(units, n, avgPlacement) : [],
    items: n ? finalizeRows(items, n, avgPlacement) : [],
    traits: n ? finalizeRows(traits, n, avgPlacement) : [],
  }
}

// ── Current-patch index, kept in memory ─────────────────────────────────────
let current = null // { patch, boards, builtAt }
const resultCache = new Map()

export function setBoardIndex(patch, boards) {
  current = { patch, boards, builtAt: new Date().toISOString() }
  resultCache.clear()
}

function cacheKey(filters) {
  return JSON.stringify(filters)
}

// Route entry point. `ready: false` until the first aggregation pass after
// startup has built the index (never when background jobs are disabled).
export function exploreCurrentPatch(query) {
  const filters = parseExplorerQuery(query)
  if (!current) return { ready: false, patch: null, filters }
  const key = cacheKey(filters)
  const cached = resultCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const value = { ready: true, patch: current.patch, builtAt: current.builtAt, filters, ...exploreBoards(current.boards, filters) }
  resultCache.set(key, { at: Date.now(), value })
  return value
}
