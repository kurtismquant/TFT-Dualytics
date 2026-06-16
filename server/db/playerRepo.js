import { getPlayersCollection } from './mongo.js'

export async function findPlayerByRiotId(gameNameLower, tagLineLower) {
  const players = getPlayersCollection()
  if (!players) return null
  return players.findOne({ gameNameLower, tagLineLower })
}
//note maybe doesnt have to limit to 20
export async function findPlayersByGameName(gameNameLower) {
  const players = getPlayersCollection()
  if (!players) return []
  return players
    .find({ gameNameLower })
    .project({
      puuid: 1,
      accountDetails: 1,
      gameNameLower: 1,
      tagLineLower: 1,
      tier: 1,
      rank: 1,
      leaguePoints: 1,
      lastUpdated: 1,
    })
    .sort({ lastUpdated: -1, tagLineLower: 1 })
    .limit(20)
    .toArray()
}

export async function findPlayerByPuuid(puuid) {
  const players = getPlayersCollection()
  if (!players) return null
  return players.findOne({ puuid })
}

export async function findPlayersByPuuids(puuids) {
  const players = getPlayersCollection()
  const uniquePuuids = [...new Set((puuids || []).filter(Boolean))]
  if (!players || uniquePuuids.length === 0) return []
  return players
    .find({ puuid: { $in: uniquePuuids } })
    .project({
      puuid: 1,
      tier: 1,
      rank: 1,
      leaguePoints: 1,
      rankUpdatedAt: 1,
    })
    .toArray()
}

// Upsert player — $set updates mutable fields every call;
// $setOnInsert initializes arrays only on document creation so accumulated
// matchIds and partners are never overwritten.
export async function upsertPlayer(puuid, fields) {
  const players = getPlayersCollection()
  if (!players) return
  const { gameNameLower, tagLineLower, accountDetails, tier, rank, leaguePoints, lastUpdated } = fields
  const setFields = { lastUpdated: lastUpdated ?? new Date() }
  if (gameNameLower !== undefined) setFields.gameNameLower = gameNameLower
  if (tagLineLower !== undefined) setFields.tagLineLower = tagLineLower
  if (accountDetails !== undefined) setFields.accountDetails = accountDetails
  if (tier !== undefined) setFields.tier = tier
  if (rank !== undefined) setFields.rank = rank
  if (leaguePoints !== undefined) setFields.leaguePoints = leaguePoints

  await players.updateOne(
    { puuid },
    {
      $set: setFields,
      $setOnInsert: { puuid, matchIds: [], partners: [] },
    },
    { upsert: true }
  )
}

// Append matchIds using $addToSet — MongoDB prevents duplicates automatically.
export async function addMatchIdsToPlayer(puuid, matchIds) {
  const players = getPlayersCollection()
  if (!players || !matchIds.length) return
  await players.updateOne(
    { puuid },
    { $addToSet: { matchIds: { $each: matchIds } } }
  )
}

export async function updatePlayerRank(puuid, { tier, rank, leaguePoints }) {
  const players = getPlayersCollection()
  if (!players) return
  await players.updateOne(
    { puuid },
    { $set: { tier, rank, leaguePoints, rankUpdatedAt: new Date(), lastUpdated: new Date() } }
  )
}

export async function markMatchHistorySynced(puuid, syncedAt = new Date(), syncedThrough = null) {
  const players = getPlayersCollection()
  if (!players) return
  const setFields = { matchHistorySyncedAt: syncedAt, lastUpdated: syncedAt }
  if (syncedThrough !== null) setFields.matchHistorySyncedThrough = syncedThrough
  await players.updateOne(
    { puuid },
    { $set: setFields }
  )
}

// Case-insensitive prefix search for autocomplete. Splits on `#` if present.
// Escapes regex metacharacters so user input can't break the query.
// used for search bar autocomplete
// note when no results maybe use updated algorithm for typos
export async function searchPlayers(query, limit = 8) {
  const players = getPlayersCollection()
  if (!players) return []
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const cap = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 25)

  const filter = {}
  const hashIdx = trimmed.indexOf('#')
  if (hashIdx >= 0) {
    const namePart = trimmed.slice(0, hashIdx).toLowerCase()
    const tagPart = trimmed.slice(hashIdx + 1).toLowerCase()
    if (namePart) filter.gameNameLower = new RegExp('^' + escape(namePart))
    if (tagPart) filter.tagLineLower = new RegExp('^' + escape(tagPart))
  } else {
    filter.gameNameLower = new RegExp('^' + escape(trimmed.toLowerCase()))
  }
  if (!Object.keys(filter).length) return []

  const docs = await players
    .find(filter, { projection: { accountDetails: 1, tier: 1, rank: 1, _id: 0 } })
    .limit(cap)
    .toArray()

  return docs
    .filter(d => d.accountDetails?.gameName && d.accountDetails?.tagLine)
    .map(d => ({
      gameName: d.accountDetails.gameName,
      tagLine: d.accountDetails.tagLine,
      tier: d.tier ?? null,
      rank: d.rank ?? null,
    }))
}

// Increment gamesPlayed for an existing partner or push a new partner entry.
export async function upsertPartner(puuid, partnerPuuid, matchDate) {
  const players = getPlayersCollection()
  if (!players) return
  const result = await players.updateOne(
    { puuid, 'partners.puuid': partnerPuuid },
    {
      $inc: { 'partners.$.gamesPlayed': 1 },
      $set: { 'partners.$.lastPlayed': matchDate },
    }
  )
  if (result.matchedCount === 0) {
    await players.updateOne(
      { puuid },
      {
        $push: {
          partners: { puuid: partnerPuuid, gamesPlayed: 1, lastPlayed: matchDate },
        },
      }
    )
  }
}
