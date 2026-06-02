import { getMatchesCollection } from '../db/mongo.js'
import { replaceAggregatedComps, getAggregatedComps, selectTopComps } from '../db/aggregatedCompsRepo.js'
import { deduplicateUnits, hadUnitDoubling } from './unitUtils.js'
import { toTeamPlacement as teamPlacement } from './teamPlacement.js'
// Comps share the Stats patch logic so both pages label and filter patches the
// same way: game_version carries the LoL number (16.x), shown to users as TFT (17.x).
// Patch math comes from the shared patchFilters module; patch *discovery* (a DB
// query) still lives in statsAggregator.
import { buildStatsMatchFilter } from './patchFilters.js'
import { getAvailablePatches } from './statsAggregator.js'

const TOP_PARTNERS_LIMIT = 3
const COMP_MERGE_SHARED_UNITS = 6
const THIEVES_GLOVES = 'TFT_Item_ThievesGloves'

function buildCompFingerprint(unitIds) {
  return unitIds.slice().sort().join('|')
}

function isDoubleUpInfo(info) {
  return info?.tft_game_type === 'pairs'
}

function getParticipants(info) {
  return info.participants || []
}

function extractComp(participant) {
  const doubled = hadUnitDoubling(participant.units)
  const units = deduplicateUnits(participant.units || [])
  if (units.length === 0) return null
  const unitIds = units.map(u => u.character_id)
  return {
    fingerprint: buildCompFingerprint(unitIds),
    unitOrder: unitIds,
    unitObservations: units.map(u => ({
      id: u.character_id,
      tier: u.tier,
      items: u.itemNames || [],
    })),
    // Snapshotting traits from the first participant is intentional — the
    // user's request only covers placement, items, and stars.
    traits: (participant.traits || [])
      .filter(t => t.tier_current > 0)
      .map(t => ({
        id: t.name,
        // When the Riot API doubles all units it also doubles num_units per trait
        numUnits: doubled ? Math.round(t.num_units / 2) : t.num_units,
        tierCurrent: t.tier_current,
        style: t.style,
      })),
  }
}

function indexParticipantComps(participants) {
  const compsByPuuid = new Map()
  for (const p of participants) {
    const comp = extractComp(p)
    if (!comp) continue
    compsByPuuid.set(p.puuid, { comp, participant: p })
  }
  return compsByPuuid
}

function createCompStats(comp, firstSeen) {
  return {
    fingerprint: comp.fingerprint,
    unitOrder: comp.unitOrder,
    uniqueUnitIds: new Set(comp.unitOrder),
    traits: comp.traits,
    placements: [],
    unitAgg: new Map(),
    partners: new Map(),
    firstSeen,
    preservedUnitTiers: null,
  }
}

function createPartnerStats(comp, firstSeen) {
  return {
    fingerprint: comp.fingerprint,
    unitOrder: comp.unitOrder,
    uniqueUnitIds: new Set(comp.unitOrder),
    traits: comp.traits,
    placements: [],
    unitAgg: new Map(),
    firstSeen,
    preservedUnitTiers: null,
  }
}

function ensureCompStats(compStats, comp) {
  let stats = compStats.get(comp.fingerprint)
  if (!stats) {
    stats = createCompStats(comp, compStats.size)
    compStats.set(comp.fingerprint, stats)
  }
  return stats
}

function ensurePartnerStats(stats, partnerComp) {
  let partner = stats.partners.get(partnerComp.fingerprint)
  if (!partner) {
    partner = createPartnerStats(partnerComp, stats.partners.size)
    stats.partners.set(partnerComp.fingerprint, partner)
  }
  return partner
}

function makeUnitAgg() {
  return {
    threeStarCount: 0,
    threeItemCount: 0,
    thievesGlovesCount: 0,
    threeItemComboCounts: new Map(),
    threeItemComboLookup: new Map(),
  }
}

function recordThreeItemCombo(agg, items) {
  const sorted = items.slice().sort()
  const key = sorted.join('|')
  agg.threeItemComboCounts.set(key, (agg.threeItemComboCounts.get(key) || 0) + 1)
  if (!agg.threeItemComboLookup.has(key)) {
    agg.threeItemComboLookup.set(key, sorted)
  }
}

function recordObservations(stats, comp) {
  for (const obs of comp.unitObservations) {
    let agg = stats.unitAgg.get(obs.id)
    if (!agg) {
      agg = makeUnitAgg()
      stats.unitAgg.set(obs.id, agg)
    }
    if (obs.tier === 3) agg.threeStarCount += 1
    // Thief's Gloves occupies all 3 item slots; the API returns it as a single
    // item so it never forms a 3-item combo. Track it independently.
    if (obs.items.includes(THIEVES_GLOVES)) {
      agg.thievesGlovesCount += 1
    } else if (obs.items.length === 3) {
      agg.threeItemCount += 1
      recordThreeItemCombo(agg, obs.items)
    }
  }
}

function findBestItemCombo(agg) {
  let bestKey = null
  let bestCount = -1
  for (const [key, count] of agg.threeItemComboCounts) {
    if (count > bestCount || (count === bestCount && (bestKey === null || key < bestKey))) {
      bestKey = key
      bestCount = count
    }
  }
  return agg.threeItemComboLookup.get(bestKey) || []
}

function resolveUnitItems(agg, half) {
  if (agg && agg.thievesGlovesCount >= half) {
    return [THIEVES_GLOVES]
  }
  if (agg && agg.threeItemCount >= half && agg.threeItemComboCounts.size > 0) {
    return findBestItemCombo(agg)
  }
  return []
}

function resolveUnits(unitOrder, unitAgg, totalGames, preservedUnitTiers = null) {
  const half = totalGames / 2
  // Track processed IDs: if the same character_id appears twice, the second
  // copy gets no stars and no items to avoid showing two identical builds.
  const processed = new Set()
  return unitOrder.map((id, index) => {
    if (processed.has(id)) return { id, tier: null, items: [] }
    processed.add(id)

    const agg = unitAgg.get(id)
    const tier = preservedUnitTiers ? preservedUnitTiers[index] : (agg && agg.threeStarCount >= half ? 3 : null)
    const items = resolveUnitItems(agg, half)
    return { id, tier, items }
  })
}

function findPartnerEntry(compsByPuuid, puuid, participant) {
  return [...compsByPuuid.values()].find(
    e => e.participant.puuid !== puuid
      && e.participant.partner_group_id != null
      && e.participant.partner_group_id === participant.partner_group_id
  )
}

function recordCompGame(stats, participant, comp) {
  stats.placements.push(teamPlacement(participant.placement))
  recordObservations(stats, comp)
}

function recordPartnerGame(stats, partnerEntry) {
  const partnerComp = partnerEntry.comp
  const partner = ensurePartnerStats(stats, partnerComp)
  partner.placements.push(teamPlacement(partnerEntry.participant.placement))
  recordObservations(partner, partnerComp)
}

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function winRate(placements) {
  return placements.filter(p => p === 1).length / placements.length
}

function rankComps(a, b) {
  return b.playCount - a.playCount || a.avgPlacement - b.avgPlacement
}

function rankPartners(a, b) {
  return b.pairCount - a.pairCount || a.avgPlacement - b.avgPlacement
}

function rankMergeCandidates(a, b) {
  return b.playCount - a.playCount
    || b.unitCount - a.unitCount
    || a.avgPlacement - b.avgPlacement
    || a.firstSeen - b.firstSeen
}

function sharesAtLeastUniqueUnits(a, b, minimum) {
  if (Math.min(a.size, b.size) < minimum) return false

  const [smaller, larger] = a.size < b.size ? [a, b] : [b, a]
  let shared = 0
  for (const id of smaller) {
    if (!larger.has(id)) continue
    shared += 1
    if (shared >= minimum) return true
  }
  return false
}

function mergeThreeItemCombos(targetAgg, sourceAgg) {
  for (const [key, count] of sourceAgg.threeItemComboCounts) {
    targetAgg.threeItemComboCounts.set(key, (targetAgg.threeItemComboCounts.get(key) || 0) + count)
  }
  for (const [key, items] of sourceAgg.threeItemComboLookup) {
    if (!targetAgg.threeItemComboLookup.has(key)) {
      targetAgg.threeItemComboLookup.set(key, items.slice())
    }
  }
}

function cloneUnitAgg(sourceAgg) {
  const targetAgg = makeUnitAgg()
  targetAgg.threeStarCount = sourceAgg.threeStarCount
  targetAgg.threeItemCount = sourceAgg.threeItemCount
  targetAgg.thievesGlovesCount = sourceAgg.thievesGlovesCount
  mergeThreeItemCombos(targetAgg, sourceAgg)
  return targetAgg
}

function cloneUnitAggMap(sourceUnitAgg) {
  const cloned = new Map()
  for (const [id, agg] of sourceUnitAgg) {
    cloned.set(id, cloneUnitAgg(agg))
  }
  return cloned
}

function clonePartnerStats(sourcePartner) {
  return {
    fingerprint: sourcePartner.fingerprint,
    unitOrder: sourcePartner.unitOrder.slice(),
    uniqueUnitIds: new Set(sourcePartner.uniqueUnitIds),
    traits: sourcePartner.traits.map(t => ({ ...t })),
    placements: sourcePartner.placements.slice(),
    unitAgg: cloneUnitAggMap(sourcePartner.unitAgg),
    firstSeen: sourcePartner.firstSeen,
    preservedUnitTiers: sourcePartner.preservedUnitTiers?.slice() ?? null,
  }
}

function preserveResolvedUnitTiers(stats) {
  if (stats.preservedUnitTiers) return
  stats.preservedUnitTiers = resolveUnits(stats.unitOrder, stats.unitAgg, stats.placements.length)
    .map(unit => unit.tier)
}

function mergeUnitItemAgg(targetUnitAgg, sourceUnitAgg) {
  for (const [id, sourceAgg] of sourceUnitAgg) {
    let targetAgg = targetUnitAgg.get(id)
    if (!targetAgg) {
      targetAgg = makeUnitAgg()
      targetUnitAgg.set(id, targetAgg)
    }

    targetAgg.threeItemCount += sourceAgg.threeItemCount
    targetAgg.thievesGlovesCount += sourceAgg.thievesGlovesCount
    mergeThreeItemCombos(targetAgg, sourceAgg)
  }
}

function mergePartnerStats(targetStats, sourceStats) {
  for (const sourcePartner of sourceStats.partners.values()) {
    const targetPartner = targetStats.partners.get(sourcePartner.fingerprint)
    if (!targetPartner) {
      const clonedPartner = clonePartnerStats(sourcePartner)
      clonedPartner.firstSeen = targetStats.partners.size
      targetStats.partners.set(sourcePartner.fingerprint, clonedPartner)
      continue
    }

    preserveResolvedUnitTiers(targetPartner)
    targetPartner.placements.push(...sourcePartner.placements)
    mergeUnitItemAgg(targetPartner.unitAgg, sourcePartner.unitAgg)
  }
}

function mergeCompStats(targetStats, sourceStats) {
  preserveResolvedUnitTiers(targetStats)
  targetStats.placements.push(...sourceStats.placements)
  mergeUnitItemAgg(targetStats.unitAgg, sourceStats.unitAgg)
  mergePartnerStats(targetStats, sourceStats)
}

function mergePartnerCompStats(targetPartner, sourcePartner) {
  preserveResolvedUnitTiers(targetPartner)
  targetPartner.placements.push(...sourcePartner.placements)
  mergeUnitItemAgg(targetPartner.unitAgg, sourcePartner.unitAgg)
}

function buildMergeCandidate(stats) {
  return {
    stats,
    fingerprint: stats.fingerprint,
    playCount: stats.placements.length,
    unitCount: stats.uniqueUnitIds.size,
    avgPlacement: average(stats.placements),
    firstSeen: stats.firstSeen,
  }
}

function mergeSimilarStats(statsValues, mergeStats) {
  const candidates = statsValues
    .filter(stats => stats.placements.length > 0)
    .map(stats => buildMergeCandidate(stats))
    .sort(rankMergeCandidates)

  const mergedFingerprints = new Set()

  for (let targetIndex = 0; targetIndex < candidates.length; targetIndex += 1) {
    const target = candidates[targetIndex]
    if (mergedFingerprints.has(target.fingerprint)) continue

    for (let sourceIndex = targetIndex + 1; sourceIndex < candidates.length; sourceIndex += 1) {
      const source = candidates[sourceIndex]
      if (mergedFingerprints.has(source.fingerprint)) continue
      if (!sharesAtLeastUniqueUnits(target.stats.uniqueUnitIds, source.stats.uniqueUnitIds, COMP_MERGE_SHARED_UNITS)) continue

      mergeStats(target.stats, source.stats)
      mergedFingerprints.add(source.fingerprint)
    }
  }

  return candidates
    .filter(candidate => !mergedFingerprints.has(candidate.fingerprint))
    .map(candidate => candidate.stats)
}

function mergeSimilarCompStats(compStats) {
  return mergeSimilarStats([...compStats.values()], mergeCompStats)
}

function mergeSimilarPartnerStats(partners) {
  return mergeSimilarStats([...partners.values()], mergePartnerCompStats)
}

function buildPartnerResult(partner) {
  const pairCount = partner.placements.length
  return {
    fingerprint: partner.fingerprint,
    units: resolveUnits(partner.unitOrder, partner.unitAgg, pairCount, partner.preservedUnitTiers),
    traits: partner.traits,
    pairCount,
    avgPlacement: average(partner.placements),
    winRate: winRate(partner.placements),
  }
}

function buildTopPartners(stats) {
  return mergeSimilarPartnerStats(stats.partners)
    .map(buildPartnerResult)
    .sort(rankPartners)
    .slice(0, TOP_PARTNERS_LIMIT)
}

function buildCompResult(stats) {
  const playCount = stats.placements.length
  if (playCount === 0) return null

  return {
    fingerprint: stats.fingerprint,
    units: resolveUnits(stats.unitOrder, stats.unitAgg, playCount, stats.preservedUnitTiers),
    traits: stats.traits,
    playCount,
    avgPlacement: average(stats.placements),
    winRate: winRate(stats.placements),
    topPartners: buildTopPartners(stats),
  }
}

// Pure reducer — exported for testability. Takes raw match docs in the Riot
// shape (info.participants[].character_id, partner_group_id, etc.).
export function aggregateComps(matches, { maxComps = null } = {}) {
  const compStats = new Map()

  for (const match of matches) {
    const info = match?.info
    if (!isDoubleUpInfo(info)) continue

    const participants = getParticipants(info)
    const compsByPuuid = indexParticipantComps(participants)

    for (const [puuid, { comp, participant }] of compsByPuuid) {
      const partnerEntry = findPartnerEntry(compsByPuuid, puuid, participant)
      const stats = ensureCompStats(compStats, comp)
      recordCompGame(stats, participant, comp)
      if (partnerEntry) recordPartnerGame(stats, partnerEntry)
    }
  }

  const results = mergeSimilarCompStats(compStats)
    .map(buildCompResult)
    .filter(Boolean)
    .sort(rankComps)

  if (typeof maxComps === 'number' && Number.isFinite(maxComps) && maxComps > 0) {
    return results.slice(0, maxComps)
  }

  return results
}

// Builds the Mongo filter for a comp aggregation read. `patch` is the TFT label
// (e.g. "17.2"); buildStatsMatchFilter converts it back to the LoL game_version
// regex (16.x) used in the raw Riot field.
export function buildCompAggregationMatchFilter(patch = null) {
  return buildStatsMatchFilter(patch)
}

// Loads patch-filtered Double Up match docs in the raw Riot shape for aggregation.
async function loadPatchMatches(matches, patch) {
  return matches
    .find(buildCompAggregationMatchFilter(patch), { projection: { _id: 0, info: 1, gameDatetime: 1 } })
    .toArray()
}

export async function runCompAggregation() {
  const matches = getMatchesCollection()
  if (!matches) {
    console.log('Skipping comp aggregation: MongoDB unavailable')
    return
  }

  // Default to the newest patch with data, expressed as a TFT label (17.x).
  const patch = (await getAvailablePatches())[0] ?? null
  const docs = await loadPatchMatches(matches, patch)

  const comps = aggregateComps(docs)
  await replaceAggregatedComps(comps, docs.length)
  console.log(`Comp aggregation: ${comps.length} comps from ${docs.length} Double Up matches on patch ${patch ?? 'unknown'}`)
}

const DEMAND_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

// Older patches aren't in the stored (current-patch) collection, so aggregate
// them on demand and cache the full result per patch. Limit is applied at read
// time so changing it never forces a re-aggregation.
const patchCache = new Map() // tftPatch -> { comps, matchCount, computedAt }
let lastCurrentRefresh = 0

async function refreshCurrentIfStale() {
  const now = Date.now()
  if (now - lastCurrentRefresh < DEMAND_COOLDOWN_MS) return
  lastCurrentRefresh = now // set before await to prevent concurrent triggers
  await runCompAggregation()
}

async function getOnDemandPatchComps(matches, patch, limit) {
  const now = Date.now()
  let entry = patchCache.get(patch)
  if (!entry || now - entry.computedAt >= DEMAND_COOLDOWN_MS) {
    const docs = await loadPatchMatches(matches, patch)
    entry = { comps: aggregateComps(docs), matchCount: docs.length, computedAt: now }
    patchCache.set(patch, entry)
  }
  return {
    comps: selectTopComps(entry.comps, entry.matchCount, limit),
    matchCount: entry.matchCount,
    lastUpdated: new Date(entry.computedAt).toISOString(),
  }
}

function latestCompTimestamp(comps) {
  const max = comps.reduce((acc, c) => {
    const t = c.lastUpdated ? new Date(c.lastUpdated).getTime() : 0
    return t > acc ? t : acc
  }, 0)
  return max ? new Date(max).toISOString() : null
}

// Single entry point for the /api/comps route. Resolves the available patches,
// picks the selected one (mirrors Stats), and returns its comps — from the
// stored collection for the current patch, or on-demand for older patches.
export async function getComps({ patch = null, limit = 20 } = {}) {
  const matches = getMatchesCollection()
  if (!matches) {
    return { comps: [], matchCount: 0, patches: [], patch: null, lastUpdated: null }
  }

  const patches = await getAvailablePatches()
  const currentPatch = patches[0] ?? null
  const selectedPatch = patch && patches.includes(patch) ? patch : currentPatch

  if (!selectedPatch) {
    return { comps: [], matchCount: 0, patches, patch: null, lastUpdated: null }
  }

  if (selectedPatch === currentPatch) {
    await refreshCurrentIfStale()
    const { comps, matchCount } = await getAggregatedComps(limit)
    return { comps, matchCount, patches, patch: selectedPatch, lastUpdated: latestCompTimestamp(comps) }
  }

  const result = await getOnDemandPatchComps(matches, selectedPatch, limit)
  return { ...result, patches, patch: selectedPatch }
}
