import { getLeaderboardsCollection } from './mongo.js'
import { CURRENT_SET } from '../constants/game.js'

// Riot resets the ranked ladder each set, so a stored ladder is only valid for the
// set it was fetched in. A doc from another set (or from before docs were tagged
// with `set`) is treated as missing, which makes every reader — the /api/leaderboard
// route, the ingest daemon and the hourly match sync — refresh it instead of
// serving or seeding from last set's players.
export async function getLeaderboard(region) {
  const collection = getLeaderboardsCollection()
  if (!collection) return null
  return collection.findOne({ region, set: CURRENT_SET }, { projection: { _id: 0 } })
}

export async function replaceLeaderboard(region, entries) {
  const collection = getLeaderboardsCollection()
  if (!collection) return
  await collection.updateOne(
    { region },
    { $set: { region, set: CURRENT_SET, entries, updatedAt: new Date() } },
    { upsert: true }
  )
}
