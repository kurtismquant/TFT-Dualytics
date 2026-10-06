import { getMatchesCollection } from '../db/mongo.js'
import { getAggregatedUnitItems } from '../db/aggregatedUnitItemsRepo.js'
import { deduplicateUnits } from './unitUtils.js'
import { toTeamPlacement } from './teamPlacement.js'
import { buildStatsMatchFilter } from './patchFilters.js'
import { getAvailablePatches } from './statsAggregator.js'
import { THIEVES_GLOVES } from '../constants/game.js'

// A combo needs at least this many boards before it's shown. Below it the
// avg placement is too noisy to rank builds by.
export const MIN_COMBO_GAMES = 10

// Placeholder item Riot sometimes reports in an empty slot. A "combo" that
// includes it isn't a real 3-item build.
const EMPTY_BAG = 'TFT_Item_EmptyBag'

// Accepts the character_id shape Riot uses (e.g. "TFT18_Xayah"). Validated
// before it's used as a Mongo filter value.
const UNIT_ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/

const CACHE_TTL_MS = 60 * 1000
const PATCH_CACHE_TTL_MS = 60 * 60 * 1000
const resultCache = new Map() // `${unitId}|${patch}` -> { at, value }
const patchCache = new Map() // older patch -> { at, rowsByUnit }

function isComboBuild(items) {
  return items.length === 3 && !items.includes(THIEVES_GLOVES) && !items.includes(EMPTY_BAG)
}

// Riot's `tier` is the star level. Clamp to 1-3 so every game lands in exactly one
// bucket and the per-star totals always sum to the overall totals.
const STAR_LEVELS = ['1', '2', '3']

function starLevel(unit) {
  const tier = Math.trunc(Number(unit.tier)) || 1
  return String(Math.min(3, Math.max(1, tier)))
}

function emptyUnitStar() {
  return { games: 0, placementTotal: 0, wins: 0, top2: 0, threeItemGames: 0 }
}

function emptyComboStar() {
  return { count: 0, placementTotal: 0, wins: 0, top2: 0 }
}

function byStarOf(makeEmpty) {
  return Object.fromEntries(STAR_LEVELS.map(star => [star, makeEmpty()]))
}

// Items a copy holds, 0-3. Thief's Gloves is reported as one item but fills all
// three slots; the EmptyBag placeholder isn't a real item.
const ITEM_COUNTS = ['0', '1', '2', '3']

function itemCount(items) {
  if (items.includes(THIEVES_GLOVES)) return '3'
  return String(Math.min(3, items.filter(item => item !== EMPTY_BAG).length))
}

// byStarItems['2']['3'] = the unit's boards at 2 star holding 3 items.
function emptyStarItems() {
  return Object.fromEntries(STAR_LEVELS.map(star => [
    star,
    Object.fromEntries(ITEM_COUNTS.map(count => [count, { games: 0, placementTotal: 0, wins: 0, top2: 0 }])),
  ]))
}

function addResult(bucket, teamPlacement) {
  bucket.placementTotal += teamPlacement
  if (teamPlacement === 1) bucket.wins += 1
  if (teamPlacement <= 2) bucket.top2 += 1
}

function ensureUnit(stats, unitId) {
  let entry = stats.get(unitId)
  if (!entry) {
    entry = {
      unitId,
      games: 0,
      threeItemGames: 0,
      byStar: byStarOf(emptyUnitStar),
      byStarItems: emptyStarItems(),
      combos: new Map(),
    }
    stats.set(unitId, entry)
  }
  return entry
}

function recordCombo(entry, sortedItems, star, teamPlacement) {
  const key = sortedItems.join('|')
  let combo = entry.combos.get(key)
  if (!combo) {
    combo = { items: sortedItems, count: 0, placementTotal: 0, wins: 0, top2: 0, byStar: byStarOf(emptyComboStar) }
    entry.combos.set(key, combo)
  }
  combo.count += 1
  addResult(combo, teamPlacement)
  combo.byStar[star].count += 1
  addResult(combo.byStar[star], teamPlacement)
  entry.threeItemGames += 1
  entry.byStar[star].threeItemGames += 1
}

function recordBoard(stats, units, placement) {
  const teamPlacement = toTeamPlacement(placement)
  // A unit's board-level star is its highest copy (two copies of a champion can
  // be fielded at different star levels; ties go to the copy holding more items).
  // Games count once per board per unit.
  const boardCopies = new Map()
  // A doubled unit that survives dedup with the same build must not count twice.
  const seenCombos = new Set()
  for (const unit of units) {
    const unitId = unit.character_id
    if (!unitId) continue
    const entry = ensureUnit(stats, unitId)
    const star = starLevel(unit)
    const items = unit.itemNames || []
    const held = itemCount(items)
    const current = boardCopies.get(unitId)
    if (!current || star > current.star || (star === current.star && held > current.held)) {
      boardCopies.set(unitId, { entry, star, held })
    }

    if (!isComboBuild(items)) continue
    const sortedItems = items.slice().sort()
    const boardKey = `${unitId}#${sortedItems.join('|')}`
    if (seenCombos.has(boardKey)) continue
    seenCombos.add(boardKey)
    recordCombo(entry, sortedItems, star, teamPlacement)
  }

  for (const { entry, star, held } of boardCopies.values()) {
    entry.games += 1
    entry.byStar[star].games += 1
    addResult(entry.byStar[star], teamPlacement)
    entry.byStarItems[star][held].games += 1
    addResult(entry.byStarItems[star][held], teamPlacement)
  }
}

function finalizeUnit(entry, minGames) {
  // Combos below minGames overall can't reach it within any star range either,
  // so pruning on the total is safe. byStar keeps raw totals so the client can
  // sum any star range and re-derive the averages.
  const combos = [...entry.combos.values()]
    .filter(combo => combo.count >= minGames)
    .map(combo => ({
      items: combo.items,
      count: combo.count,
      avgPlacement: combo.placementTotal / combo.count,
      winRate: combo.wins / combo.count,
      top2Rate: combo.top2 / combo.count,
      frequency: entry.threeItemGames > 0 ? combo.count / entry.threeItemGames : 0,
      byStar: combo.byStar,
    }))
    .sort((a, b) => a.avgPlacement - b.avgPlacement || b.count - a.count)
  return {
    unitId: entry.unitId,
    games: entry.games,
    threeItemGames: entry.threeItemGames,
    byStar: entry.byStar,
    byStarItems: entry.byStarItems,
    combos,
  }
}

// Pure reducer over raw Double Up match docs. Returns one row per unit seen,
// holding every 3-item combo with at least `minGames` boards. Units with no
// qualifying combo are still returned (combos: []) so the page can show totals.
export function aggregateUnitItemCombos(matches, { minGames = MIN_COMBO_GAMES } = {}) {
  const stats = new Map()
  for (const match of matches) {
    const info = match?.info
    if (info?.tft_game_type !== 'pairs') continue
    for (const participant of info.participants || []) {
      const placement = Number(participant.placement)
      if (!Number.isFinite(placement)) continue
      recordBoard(stats, deduplicateUnits(participant.units || []), placement)
    }
  }
  return [...stats.values()]
    .map(entry => finalizeUnit(entry, minGames))
    .sort((a, b) => a.unitId.localeCompare(b.unitId))
}

export function isValidUnitId(unitId) {
  return typeof unitId === 'string' && UNIT_ID_PATTERN.test(unitId)
}

function emptyResult(unitId, patch, patches) {
  return { unitId, patch, patches, minGames: MIN_COMBO_GAMES, games: 0, threeItemGames: 0, byStar: null, byStarItems: null, combos: [], lastUpdated: null }
}

// Older patches aren't pre-stored, so aggregate every unit once per patch on
// demand and cache it (the same rare-path exception getComps/getStats make).
async function getOlderPatchRows(matches, patch) {
  const cached = patchCache.get(patch)
  if (cached && Date.now() - cached.at < PATCH_CACHE_TTL_MS) return cached
  const docs = await matches
    .find(buildStatsMatchFilter(patch), { projection: { _id: 0, info: 1, gameDatetime: 1 } })
    .toArray()
  const rowsByUnit = new Map(aggregateUnitItemCombos(docs).map(row => [row.unitId, row]))
  const entry = { at: Date.now(), rowsByUnit }
  patchCache.set(patch, entry)
  return entry
}

export async function getUnitItemCombos({ unitId, patch = null }) {
  if (!isValidUnitId(unitId)) {
    const err = new Error('Invalid unit id')
    err.status = 400
    throw err
  }
  const matches = getMatchesCollection()
  if (!matches) return emptyResult(unitId, null, [])

  const cacheKey = `${unitId}|${patch ?? ''}`
  const cached = resultCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const patches = await getAvailablePatches()
  const selectedPatch = patch && patches.includes(patch) ? patch : patches[0] ?? null
  if (!selectedPatch) return emptyResult(unitId, null, patches)

  let row
  let lastUpdated
  if (selectedPatch === patches[0]) {
    // Current patch: read the small per-unit doc written by the background pass.
    // Missing means the first pass hasn't finished yet (or the unit wasn't played),
    // so return empty and don't cache, rather than pulling raw matches here.
    const stored = await getAggregatedUnitItems(selectedPatch, unitId)
    if (!stored) return emptyResult(unitId, selectedPatch, patches)
    row = stored
    lastUpdated = stored.lastUpdated ? new Date(stored.lastUpdated).toISOString() : null
  } else {
    const entry = await getOlderPatchRows(matches, selectedPatch)
    row = entry.rowsByUnit.get(unitId)
    lastUpdated = new Date(entry.at).toISOString()
  }

  const value = {
    ...emptyResult(unitId, selectedPatch, patches),
    games: row?.games ?? 0,
    threeItemGames: row?.threeItemGames ?? 0,
    byStar: row?.byStar ?? null,
    byStarItems: row?.byStarItems ?? null,
    combos: row?.combos ?? [],
    lastUpdated,
  }
  resultCache.set(cacheKey, { at: Date.now(), value })
  return value
}
