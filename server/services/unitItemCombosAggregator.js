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

function ensureUnit(stats, unitId) {
  let entry = stats.get(unitId)
  if (!entry) {
    entry = { unitId, games: 0, threeItemGames: 0, combos: new Map() }
    stats.set(unitId, entry)
  }
  return entry
}

function recordCombo(entry, sortedItems, placement) {
  const key = sortedItems.join('|')
  let combo = entry.combos.get(key)
  if (!combo) {
    combo = { items: sortedItems, count: 0, placementTotal: 0, wins: 0, top2: 0 }
    entry.combos.set(key, combo)
  }
  const teamPlacement = toTeamPlacement(placement)
  combo.count += 1
  combo.placementTotal += teamPlacement
  if (teamPlacement === 1) combo.wins += 1
  if (teamPlacement <= 2) combo.top2 += 1
  entry.threeItemGames += 1
}

function recordBoard(stats, units, placement) {
  const seenUnits = new Set()
  // A doubled unit that survives dedup with the same build must not count twice.
  const seenCombos = new Set()
  for (const unit of units) {
    const unitId = unit.character_id
    if (!unitId) continue
    const entry = ensureUnit(stats, unitId)
    if (!seenUnits.has(unitId)) {
      seenUnits.add(unitId)
      entry.games += 1
    }

    const items = unit.itemNames || []
    if (!isComboBuild(items)) continue
    const sortedItems = items.slice().sort()
    const boardKey = `${unitId}#${sortedItems.join('|')}`
    if (seenCombos.has(boardKey)) continue
    seenCombos.add(boardKey)
    recordCombo(entry, sortedItems, placement)
  }
}

function finalizeUnit(entry, minGames) {
  const combos = [...entry.combos.values()]
    .filter(combo => combo.count >= minGames)
    .map(combo => ({
      items: combo.items,
      count: combo.count,
      avgPlacement: combo.placementTotal / combo.count,
      winRate: combo.wins / combo.count,
      top2Rate: combo.top2 / combo.count,
      frequency: entry.threeItemGames > 0 ? combo.count / entry.threeItemGames : 0,
    }))
    .sort((a, b) => a.avgPlacement - b.avgPlacement || b.count - a.count)
  return { unitId: entry.unitId, games: entry.games, threeItemGames: entry.threeItemGames, combos }
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
  return { unitId, patch, patches, minGames: MIN_COMBO_GAMES, games: 0, threeItemGames: 0, combos: [], lastUpdated: null }
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
    combos: row?.combos ?? [],
    lastUpdated,
  }
  resultCache.set(cacheKey, { at: Date.now(), value })
  return value
}
