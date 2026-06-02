import { getMatchesCollection } from '../db/mongo.js'
import { CURRENT_SET, LOL_SEASON, SET_LAUNCH_LOL_MINOR } from '../constants/game.js'
import { deduplicateUnits } from './unitUtils.js'

const VALID_TYPES = new Set(['units', 'items', 'traits'])
const MAX_POPULAR = 5

// Converts a raw Riot game_version string (e.g. "Version 16.9.614.1234") to the
// TFT patch label users see in the client (e.g. "17.2").
// TFT and LoL share the same two-week release cadence but use different version
// numbering: LoL uses the season number (16.x) while TFT labels patches within
// a set sequentially (17.1, 17.2, …).
export function extractPatch(gameVersion) {
  if (!gameVersion) return null
  const m = String(gameVersion).match(/(\d+)\.(\d+)/)
  if (!m) return null
  const lolMajor = parseInt(m[1], 10)
  const lolMinor = parseInt(m[2], 10)
  if (lolMajor !== LOL_SEASON) return null
  const tftMinor = lolMinor - SET_LAUNCH_LOL_MINOR + 1
  if (tftMinor < 1) return null
  return `${CURRENT_SET}.${tftMinor}`
}

// Converts a TFT patch label (e.g. "17.4") to a comparable integer (1704) so patch
// recency can be compared numerically. Returns null for null/non-current-set labels.
export function patchToNum(label) {
  const m = String(label || '').match(/^(\d+)\.(\d+)$/)
  if (!m) return null
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10)
}

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

// Converts a TFT patch label (e.g. "17.2") back to the LoL version used in game_version
// (e.g. "16.9") so DB queries can match the raw Riot field.
function lolPatchFromTft(tftPatch) {
  const m = String(tftPatch || '').match(/^(\d+)\.(\d+)$/)
  if (!m) return null
  const tftMinor = parseInt(m[2], 10)
  return `${LOL_SEASON}.${tftMinor + SET_LAUNCH_LOL_MINOR - 1}`
}

export function buildStatsMatchFilter(tftPatch = null) {
  const filter = { 'info.tft_game_type': 'pairs', tftSetNumber: CURRENT_SET }
  if (tftPatch) {
    const lolPatch = lolPatchFromTft(tftPatch)
    if (lolPatch) {
      const escaped = lolPatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter['info.game_version'] = { $regex: `\\b${escaped}\\.` }
    }
  }
  return filter
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
  entry.placementTotal += Math.ceil(placement / 2)
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

  const docs = await matches
    .find(buildStatsMatchFilter(), { projection: { _id: 0, 'info.game_version': 1, gameDatetime: 1 } })
    .sort({ gameDatetime: -1 })
    .toArray()

  const patches = []
  const seen = new Set()
  for (const doc of docs) {
    const patch = extractPatch(doc.info?.game_version)
    if (!patch || seen.has(patch)) continue
    seen.add(patch)
    patches.push(patch)
  }
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

  const patches = await getAvailablePatches()
  const selectedPatch = patch && patches.includes(patch) ? patch : patches[0] ?? null
  const docs = await matches
    .find(buildStatsMatchFilter(selectedPatch), { projection: { _id: 0, info: 1, gameDatetime: 1 } })
    .toArray()
  const stats = aggregateStats(docs, type)

  return {
    type,
    patch: selectedPatch,
    patches,
    ...stats,
  }
}
