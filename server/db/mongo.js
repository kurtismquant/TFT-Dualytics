import { MongoClient } from 'mongodb'

let client = null
let db = null

export async function connectMongo() {
  if (db) return db
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  db = client.db()
  return db
}

export const getPlayersCollection = () => db?.collection('players') ?? null
export const getMatchesCollection = () => db?.collection('matches') ?? null
export const getAggregatedCompsCollection = () => db?.collection('aggregated_comps') ?? null
export const getLeaderboardsCollection = () => db?.collection('leaderboards') ?? null
export const getRankSnapshotsCollection = () => db?.collection('rank_snapshots') ?? null
export const getIngestionStateCollection = () => db?.collection('ingestion_state') ?? null

export async function createIndexes() {
  const players = getPlayersCollection()
  const matches = getMatchesCollection()
  const aggregatedComps = getAggregatedCompsCollection()
  const leaderboards = getLeaderboardsCollection()
  const rankSnapshots = getRankSnapshotsCollection()
  if (!players || !matches || !aggregatedComps || !leaderboards || !rankSnapshots) return

  await players.createIndex({ puuid: 1 }, { unique: true })
  await players.createIndex({ gameNameLower: 1, tagLineLower: 1 }, { unique: true })
  await players.createIndex({ gameNameLower: 1, lastUpdated: -1 })

  await matches.createIndex({ matchId: 1 }, { unique: true })
  // Multikey compound index: fast lookup of all matches for a given player sorted by time
  await matches.createIndex({ 'participants.puuid': 1, gameDatetime: -1 })
  // Speeds up the comp-aggregation scan over recent Double Up matches.
  await matches.createIndex({ 'info.tft_game_type': 1, gameDatetime: -1 })
  // Optional 90-day TTL — uncomment to auto-expire old match documents:
  // await matches.createIndex({ gameDatetime: 1 }, { expireAfterSeconds: 7776000 })

  await aggregatedComps.createIndex({ fingerprint: 1 }, { unique: true })
  await aggregatedComps.createIndex({ playCount: -1 })

  await leaderboards.createIndex({ region: 1 }, { unique: true })

  await rankSnapshots.createIndex({ puuid: 1, recordedAt: -1 })
}

export async function closeMongo() {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}
