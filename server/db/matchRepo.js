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

// Build the trimmed document shape stored in the DB from a raw Riot API response.
// We keep only the fields the consumers actually read — compsAggregator,
// statsAggregator, and matchNormalizers all read info.participants[].<raw_field>
// directly, so raw snake_case names are preserved inside info. Everything else
// (augments, companion, missions, gold_left, players_eliminated, time_eliminated,
// metadata beyond match_id, and the formerly-duplicated flat participant payload)
// is dropped — that cuts each doc by ~56%. See estimate in scripts/trim-matches.js.
//
// Safe to call on an already-stored (trimmed) doc too — the migration relies on this,
// so it must remain idempotent: re-reading already-trimmed fields yields the same shape.
export function buildMatchDocument(rawMatch) {
  const info = rawMatch?.info ?? {}
  const metadata = rawMatch?.metadata ?? {}
  const matchId = metadata.match_id ?? rawMatch.matchId

  const trimmedParticipants = (info.participants ?? []).map(p => ({
    puuid: p.puuid,
    placement: p.placement,
    level: p.level,
    last_round: p.last_round,
    total_damage_to_players: p.total_damage_to_players,
    partner_group_id: p.partner_group_id ?? null,
    riotIdGameName: p.riotIdGameName ?? null,
    riotIdTagline: p.riotIdTagline ?? null,
    units: (p.units ?? []).map(u => ({
      character_id: u.character_id,
      tier: u.tier,
      itemNames: u.itemNames ?? [],
    })),
    traits: (p.traits ?? []).map(t => ({
      name: t.name,
      num_units: t.num_units,
      tier_current: t.tier_current,
      style: t.style,
    })),
  }))

  // Fall back to the input's top-level fields so this works on a raw Riot match
  // OR an already-stored doc (queue_id / game_length live only on raw info, which
  // the trimmed shape drops — the fallback keeps the function idempotent).
  const gameDatetime = info.game_datetime ?? rawMatch.gameDatetime ?? 0
  return {
    matchId,
    gameDatetime,
    // Date copy of gameDatetime purely so a TTL index can auto-expire old matches.
    // gameDatetime stays a number — TTL only works on a BSON Date field.
    gameDate: gameDatetime ? new Date(gameDatetime) : (rawMatch.gameDate ?? new Date()),
    gameLength: info.game_length ?? rawMatch.gameLength ?? 0,
    queueId: info.queue_id ?? rawMatch.queueId ?? 0,
    tftSetNumber: info.tft_set_number ?? rawMatch.tftSetNumber ?? 0,
    gameVersion: info.game_version ?? rawMatch.gameVersion ?? '',
    // Trimmed raw shape — only the fields read by the aggregators / normalizer.
    info: {
      tft_game_type: info.tft_game_type,
      tft_set_number: info.tft_set_number,
      game_datetime: info.game_datetime,
      game_version: info.game_version,
      participants: trimmedParticipants,
    },
    // normalizeMatch reads metadata.match_id; nothing else in metadata is used.
    metadata: { match_id: matchId },
    // Flat participants array carries only puuid — the sole field used by the
    // { 'participants.puuid': 1, gameDatetime: -1 } multikey index.
    participants: (info.participants ?? []).map(p => ({ puuid: p.puuid })),
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
