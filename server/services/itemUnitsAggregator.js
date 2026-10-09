import { getMatchesCollection } from '../db/mongo.js'
import { getAggregatedItemUnits } from '../db/aggregatedItemUnitsRepo.js'
import { buildStatsMatchFilter } from './patchFilters.js'
import { getAvailablePatches } from './statsAggregator.js'
import { collectUnitItemStats, isValidUnitId, MIN_COMBO_GAMES } from './unitItemCombosAggregator.js'

const CACHE_TTL_MS = 60 * 1000
const PATCH_CACHE_TTL_MS = 60 * 60 * 1000
const resultCache = new Map() // `${itemId}|${patch}` -> { at, value }
const patchCache = new Map() // older patch -> { at, rowsByItem }

// Item apiNames (e.g. "TFT_Item_InfinityEdge") share the unit id character set.
export const isValidItemId = isValidUnitId

function unitAvgPlacement(entry) {
  if (!entry.games) return null
  const total = Object.values(entry.byStar).reduce((sum, star) => sum + star.placementTotal, 0)
  return total / entry.games
}

// Inverts the per-unit single-item totals into one row per item: every unit that
// held it on at least `minGames` boards. Counting matches the unit page's items
// table exactly (once per board per unit, team placement), so the numbers agree.
export function finalizeItemRows(stats, minGames = MIN_COMBO_GAMES) {
  const byItem = new Map()
  for (const entry of stats.values()) {
    const baseline = unitAvgPlacement(entry)
    for (const row of entry.singleItems.values()) {
      let item = byItem.get(row.item)
      if (!item) {
        item = { itemId: row.item, games: 0, placementTotal: 0, wins: 0, top2: 0, candidates: [] }
        byItem.set(row.item, item)
      }
      // Every unit counts toward the item's total, even those below the floor,
      // so each row's share is of all the item's boards.
      item.games += row.count
      item.placementTotal += row.placementTotal
      item.wins += row.wins
      item.top2 += row.top2
      if (row.count < minGames) continue
      const avgPlacement = row.placementTotal / row.count
      item.candidates.push({
        unitId: entry.unitId,
        count: row.count,
        avgPlacement,
        winRate: row.wins / row.count,
        top2Rate: row.top2 / row.count,
        // Share of the unit's boards that had this item.
        buildRate: entry.games > 0 ? row.count / entry.games : 0,
        unitAvgPlacement: baseline,
        // Negative = the unit places better with this item than its own average.
        delta: baseline == null ? null : avgPlacement - baseline,
      })
    }
  }
  return [...byItem.values()]
    .map(({ itemId, games, placementTotal, wins, top2, candidates }) => ({
      itemId,
      games,
      avgPlacement: placementTotal / games,
      winRate: wins / games,
      top2Rate: top2 / games,
      units: candidates
        .map(unit => ({ ...unit, share: unit.count / games }))
        .sort((a, b) => a.avgPlacement - b.avgPlacement || b.count - a.count),
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}

// Pure reducer over raw Double Up match docs: one row per item seen.
export function aggregateItemUnits(matches, { minGames = MIN_COMBO_GAMES } = {}) {
  return finalizeItemRows(collectUnitItemStats(matches), minGames)
}

function emptyResult(itemId, patch, patches) {
  return { itemId, patch, patches, minGames: MIN_COMBO_GAMES, games: 0, avgPlacement: null, winRate: null, top2Rate: null, units: [], lastUpdated: null }
}

// Older patches aren't pre-stored, so aggregate every item once per patch on
// demand and cache it (the same rare-path exception getUnitItemCombos makes).
async function getOlderPatchRows(matches, patch) {
  const cached = patchCache.get(patch)
  if (cached && Date.now() - cached.at < PATCH_CACHE_TTL_MS) return cached
  const docs = await matches
    .find(buildStatsMatchFilter(patch), { projection: { _id: 0, info: 1, gameDatetime: 1 } })
    .toArray()
  const rowsByItem = new Map(aggregateItemUnits(docs).map(row => [row.itemId, row]))
  const entry = { at: Date.now(), rowsByItem }
  patchCache.set(patch, entry)
  return entry
}

export async function getItemUnits({ itemId, patch = null }) {
  if (!isValidItemId(itemId)) {
    const err = new Error('Invalid item id')
    err.status = 400
    throw err
  }
  const matches = getMatchesCollection()
  if (!matches) return emptyResult(itemId, null, [])

  const cacheKey = `${itemId}|${patch ?? ''}`
  const cached = resultCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const patches = await getAvailablePatches()
  const selectedPatch = patch && patches.includes(patch) ? patch : patches[0] ?? null
  if (!selectedPatch) return emptyResult(itemId, null, patches)

  let row
  let lastUpdated
  if (selectedPatch === patches[0]) {
    // Current patch: read the small per-item doc written by the background pass.
    // Missing means the first pass hasn't finished yet (or nobody built the item),
    // so return empty and don't cache, rather than pulling raw matches here.
    const stored = await getAggregatedItemUnits(selectedPatch, itemId)
    if (!stored) return emptyResult(itemId, selectedPatch, patches)
    row = stored
    lastUpdated = stored.lastUpdated ? new Date(stored.lastUpdated).toISOString() : null
  } else {
    const entry = await getOlderPatchRows(matches, selectedPatch)
    row = entry.rowsByItem.get(itemId)
    lastUpdated = new Date(entry.at).toISOString()
  }

  const value = {
    ...emptyResult(itemId, selectedPatch, patches),
    games: row?.games ?? 0,
    avgPlacement: row?.avgPlacement ?? null,
    winRate: row?.winRate ?? null,
    top2Rate: row?.top2Rate ?? null,
    units: row?.units ?? [],
    lastUpdated,
  }
  resultCache.set(cacheKey, { at: Date.now(), value })
  return value
}
