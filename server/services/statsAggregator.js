import { getMatchesCollection } from '../db/mongo.js'
import { getAggregatedStats } from '../db/aggregatedStatsRepo.js'
import { deduplicateUnits } from './unitUtils.js'
import { toTeamPlacement } from './teamPlacement.js'
// Pure patch math lives in patchFilters.js (shared with the Comps aggregator).
// Re-exported here so existing importers of statsAggregator keep working.
import { extractPatch, patchToNum, buildStatsMatchFilter } from './patchFilters.js'

export { extractPatch, patchToNum, buildStatsMatchFilter }

const VALID_TYPES = new Set(['units', 'items', 'traits'])
const MAX_POPULAR = 5

// Both getStats and getAvailablePatches scan every current-patch match doc, which
// is expensive and runs on every /api/stats and /api/comps request (the landing
// page alone fires several). The underlying data only changes when the ingest
// daemon writes new matches, so a short in-memory TTL makes repeat calls instant
// without meaningfully staling the numbers.
const CACHE_TTL_MS = 60 * 1000
let patchesCache = null // { at, value }
const statsCache = new Map() // `${type}|${patch}` -> { at, value }

// Resolves the current patch and an approximate start time, for daemon ingestion
// that targets only current-patch games. "Current patch" is the newest patch present
// in stored matches (getAvailablePatches is sorted newest-first). startMs is the
// earliest current-patch game seen — used only as a safe lower bound for match-id
// listing; the daemon's sentinel early-stop defines the exact cutoff. Returns
// all-null when no data exists yet (caller then falls back to a full ingest).
export async function getCurrentPatchWindow() {
  const patch = (await getAvailablePatches())[0] ?? null
  if (!patch) return { patch: null, patchNum: null, startMs: null }
  const matches = getMatchesCollection()
  let startMs = null
  if (matches) {
    const oldest = await matches
      .find(buildStatsMatchFilter(patch), { projection: { _id: 0, gameDatetime: 1 } })
      .sort({ gameDatetime: 1 })
      .limit(1)
      .next()
    startMs = oldest?.gameDatetime ?? null
  }
  return { patch, patchNum: patchToNum(patch), startMs }
}

function makeEntry(id) {
  return {
    id,
    count: 0,
    placementTotal: 0,
    wins: 0,
    itemCounts: new Map(),
    unitCounts: new Map(),
    numUnitsTotal: 0,
  }
}

function ensureEntry(stats, id) {
  let entry = stats.get(id)
  if (!entry) {
    entry = makeEntry(id)
    stats.set(id, entry)
  }
  return entry
}

function record(entry, placement) {
  entry.count += 1
  entry.placementTotal += toTeamPlacement(placement)
  if (placement <= 2) entry.wins += 1
}

function addCount(map, id, amount = 1) {
  if (!id) return
  map.set(id, (map.get(id) || 0) + amount)
}

function topCounts(map) {
  return [...map.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, MAX_POPULAR)
}

function finalizeStats(stats, denominator, extra = {}) {
  return [...stats.values()]
    .map(entry => ({
      id: entry.id,
      ...(entry.traitId ? { traitId: entry.traitId, tier: entry.tier } : {}),
      count: entry.count,
      avgPlacement: entry.count > 0 ? entry.placementTotal / entry.count : 0,
      winRate: entry.count > 0 ? entry.wins / entry.count : 0,
      frequency: denominator > 0 ? entry.count / denominator : 0,
      popularItems: topCounts(entry.itemCounts),
      popularUnits: topCounts(entry.unitCounts),
      avgUnits: entry.count > 0 ? entry.numUnitsTotal / entry.count : null,
      ...extra,
    }))
    .sort((a, b) => b.count - a.count || a.avgPlacement - b.avgPlacement || a.id.localeCompare(b.id))
}

function recordUnitStats(stats, units, placement) {
  const seen = new Set()
  for (const unit of units) {
    const id = unit.character_id
    if (!id || seen.has(id)) continue
    seen.add(id)

    const entry = ensureEntry(stats, id)
    record(entry, placement)
    for (const itemId of unit.itemNames || []) addCount(entry.itemCounts, itemId)
  }
}

function recordItemStats(stats, units, placement) {
  for (const unit of units) {
    const unitId = unit.character_id
    for (const itemId of unit.itemNames || []) {
      const entry = ensureEntry(stats, itemId)
      record(entry, placement)
      addCount(entry.unitCounts, unitId)
    }
  }
}

function recordTraitStats(stats, participant, units, placement) {
  const unitIds = [...new Set(units.map(unit => unit.character_id).filter(Boolean))]
  for (const trait of participant.traits || []) {
    if (!trait.name || trait.tier_current <= 0) continue

    const tier = Number(trait.tier_current)
    const key = `${trait.name}#${tier}`
    let entry = stats.get(key)
    if (!entry) {
      entry = makeEntry(key)
      entry.traitId = trait.name
      entry.tier = tier
      stats.set(key, entry)
    }
    record(entry, placement)
    entry.numUnitsTotal += trait.num_units || 0
    for (const unitId of unitIds) addCount(entry.unitCounts, unitId)
  }
}

export function aggregateStats(matches, type) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid stats type: ${type}`)
  }

  const stats = new Map()
  let matchCount = 0
  let participantCount = 0
  let itemCount = 0

  for (const match of matches) {
    const info = match?.info
    if (info?.tft_game_type !== 'pairs') continue
    matchCount += 1

    for (const participant of info.participants || []) {
      const placement = Number(participant.placement)
      if (!Number.isFinite(placement)) continue

      participantCount += 1
      const units = deduplicateUnits(participant.units || [])

      if (type === 'units') recordUnitStats(stats, units, placement)
      if (type === 'items') {
        itemCount += units.reduce((sum, unit) => sum + (unit.itemNames?.length || 0), 0)
        recordItemStats(stats, units, placement)
      }
      if (type === 'traits') recordTraitStats(stats, participant, units, placement)
    }
  }

  const denominator = type === 'items' ? itemCount : participantCount
  return {
    rows: finalizeStats(stats, denominator),
    matchCount,
    participantCount,
    itemCount,
  }
}

export async function getAvailablePatches() {
  const matches = getMatchesCollection()
  if (!matches) return []

  if (patchesCache && Date.now() - patchesCache.at < CACHE_TTL_MS) {
    return patchesCache.value
  }

  // distinct() computes the unique game_version values server-side and returns only
  // those (~a handful of strings) instead of streaming every current-set Double Up
  // match over the wire. The previous find().toArray() pulled all ~12k match docs
  // just to derive the patch list — very slow against a remote (Atlas) cluster, and
  // it runs on every /api/stats and /api/comps request.
  const versions = await matches.distinct('info.game_version', buildStatsMatchFilter())

  const patches = []
  const seen = new Set()
  for (const version of versions) {
    const patch = extractPatch(version)
    if (!patch || seen.has(patch)) continue
    seen.add(patch)
    patches.push(patch)
  }
  // Newest patch first (higher patch number = more recent). This matches the prior
  // gameDatetime-desc ordering without pulling/sorting match documents.
  patches.sort((a, b) => patchToNum(b) - patchToNum(a))
  patchesCache = { at: Date.now(), value: patches }
  return patches
}

export async function getStats({ type = 'units', patch = null } = {}) {
  const matches = getMatchesCollection()
  if (!matches) {
    return { type, patch: null, patches: [], rows: [], matchCount: 0, participantCount: 0, itemCount: 0 }
  }
  if (!VALID_TYPES.has(type)) {
    const err = new Error('Stats type must be units, items, or traits')
    err.status = 400
    throw err
  }

  const cacheKey = `${type}|${patch ?? ''}`
  const cached = statsCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  const patches = await getAvailablePatches()
  const selectedPatch = patch && patches.includes(patch) ? patch : patches[0] ?? null
  if (!selectedPatch) {
    return { type, patch: null, patches, rows: [], matchCount: 0, participantCount: 0, itemCount: 0 }
  }

  // Current patch is pre-aggregated by the comp-aggregation pass (which pulls the same
  // matches) and stored, so serve it directly instead of re-streaming ~20MB of raw
  // matches per request over the slow remote link.
  if (selectedPatch === patches[0]) {
    const stored = await getAggregatedStats(selectedPatch, type)
    if (stored) {
      const value = {
        type,
        patch: selectedPatch,
        patches,
        rows: stored.rows ?? [],
        matchCount: stored.matchCount ?? 0,
        participantCount: stored.participantCount ?? 0,
        itemCount: stored.itemCount ?? 0,
      }
      statsCache.set(cacheKey, { at: Date.now(), value })
      return value
    }
    // Not aggregated yet (e.g. right after startup, before the first pass completes) —
    // return empty rather than triggering a multi-minute raw pull on the request path.
    // The background aggregation (startup + 10-min cron) populates it shortly; don't
    // cache the empty result so it recovers on the next request once data lands.
    return { type, patch: selectedPatch, patches, rows: [], matchCount: 0, participantCount: 0, itemCount: 0 }
  }

  // Older patches aren't pre-stored — aggregate them on demand (rare path).
  const docs = await matches
    .find(buildStatsMatchFilter(selectedPatch), { projection: { _id: 0, info: 1, gameDatetime: 1 } })
    .toArray()
  const stats = aggregateStats(docs, type)

  const value = {
    type,
    patch: selectedPatch,
    patches,
    ...stats,
  }
  statsCache.set(cacheKey, { at: Date.now(), value })
  return value
}
