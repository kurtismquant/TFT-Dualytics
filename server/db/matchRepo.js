import { getMatchesCollection } from './mongo.js'

// Store the raw Riot API response shape ({ matchId, info, metadata }) so
// downstream consumers can use the doc as a drop-in without any transformation.
export async function findMatch(matchId) {
  const matches = getMatchesCollection()
  if (!matches) return null
  return matches.findOne({ matchId }, { projection: { _id: 0 } })
}

// Returns a Set of matchIds that already exist in the DB.
// Uses the unique matchId index for an index-only scan — no document fetch.
export async function filterKnownMatchIds(matchIds) {
  const matches = getMatchesCollection()
  if (!matches || matchIds.length === 0) return new Set()
  const docs = await matches
    .find({ matchId: { $in: matchIds } }, { projection: { matchId: 1, _id: 0 } })
    .toArray()
  return new Set(docs.map(d => d.matchId))
}

// Returns the gameDatetime (ms) of the most recently stored match for a puuid, or null.
// Uses the compound index { 'participants.puuid': 1, gameDatetime: -1 } — index-only sort.
export async function getLatestMatchTimestamp(puuid) {
  const matches = getMatchesCollection()
  if (!matches) return null
  const doc = await matches.findOne(
    { 'participants.puuid': puuid },
    { sort: { gameDatetime: -1 }, projection: { gameDatetime: 1, _id: 0 } }
  )
  return doc?.gameDatetime ?? null
}

// Load all matches for a puuid since a given timestamp, sorted newest-first.
export async function findMatchesByPuuid(puuid, sinceTimestamp = 0) {
  const matches = getMatchesCollection()
  if (!matches) return []
  return matches
    .find(
      { 'participants.puuid': puuid, gameDatetime: { $gt: sinceTimestamp } },
      { projection: { _id: 0 } }
    )
    .sort({ gameDatetime: -1 })
    .toArray()
}

// Upsert using $setOnInsert so concurrent writes for the same matchId are safe.
// Returns { inserted: true } when a new document was created, { inserted: false }
// when the match was already present (or on an E11000 race condition).
export async function upsertMatch(matchDoc) {
  const matches = getMatchesCollection()
  if (!matches) return { inserted: false }
  try {
    const result = await matches.updateOne(
      { matchId: matchDoc.matchId },
      { $setOnInsert: { ...matchDoc, lastUpdated: new Date() } },
      { upsert: true }
    )
    return { inserted: result.upsertedCount > 0 }
  } catch (err) {
    if (err.code === 11000) return { inserted: false }
    throw err
  }
}

// Build the document shape expected by the DB from a raw Riot API response.
// Keeps info + metadata intact so the comp aggregator can use the doc directly.
// Also extracts a flat participants array for the compound multikey index.
export function buildMatchDocument(rawMatch) {
  const info = rawMatch?.info ?? {}
  const metadata = rawMatch?.metadata ?? {}
  const matchId = metadata.match_id ?? rawMatch.matchId

  const participants = (info.participants ?? []).map(p => ({
    puuid: p.puuid,
    placement: p.placement,
    level: p.level,
    goldLeft: p.gold_left ?? 0,
    totalDamageToPlayers: p.total_damage_to_players ?? 0,
    partnerGroupId: p.partner_group_id ?? null,
    win: p.placement != null && p.placement <= 2,
    traits: (p.traits ?? []).map(t => ({
      name: t.name,
      numUnits: t.num_units,
      style: t.style,
      tierCurrent: t.tier_current,
      tierTotal: t.tier_total,
    })),
    units: (p.units ?? []).map(u => ({
      characterId: u.character_id,
      rarity: u.rarity ?? 0,
      tier: u.tier,
      items: u.itemNames ?? [],
    })),
  }))

  return {
    matchId,
    gameDatetime: info.game_datetime ?? 0,
    // Date copy of gameDatetime purely so a TTL index can auto-expire old matches.
    // gameDatetime stays a number — TTL only works on a BSON Date field.
    gameDate: info.game_datetime ? new Date(info.game_datetime) : new Date(),
    gameLength: info.game_length ?? 0,
    queueId: info.queue_id ?? 0,
    tftSetNumber: info.tft_set_number ?? 0,
    gameVersion: info.game_version ?? '',
    // Preserve raw Riot shape so computeComps / isDoubleUpAndRecent work unchanged
    info,
    metadata,
    // Flat participants array for the compound multikey index query
    participants,
  }
}

// Minimal record for a non–Double Up match: just enough to dedup it in
// filterKnownMatchIds so it is never re-fetched, without storing the ~40KB
// payload. Has no `info`/`participants`, so it never surfaces in match history
// (normalizeMatch filters on info.tft_game_type) or comp/stats aggregation.
export function buildMatchStub(rawMatch) {
  const info = rawMatch?.info ?? {}
  const metadata = rawMatch?.metadata ?? {}
  const matchId = metadata.match_id ?? rawMatch.matchId
  return {
    matchId,
    gameDatetime: info.game_datetime ?? 0,
    gameDate: info.game_datetime ? new Date(info.game_datetime) : new Date(),
    gameType: info.tft_game_type ?? 'unknown',
    stub: true,
  }
}
