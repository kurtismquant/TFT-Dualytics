import '../loadEnv.js'
import { connectMongo, closeMongo, createIndexes, getMatchesCollection } from '../db/mongo.js'

// One-time maintenance:
//   1. Delete non–Double Up matches (standard/pve) — never aggregated or shown.
//   2. Backfill gameDate on remaining docs so the TTL index can expire them.
//   3. (Re)create indexes, including the gameDate TTL index.
// Safe to re-run: step 1 only targets full non-pairs docs (skips stubs), and the
// backfill only sets gameDate where missing.

async function main() {
  await connectMongo()
  const matches = getMatchesCollection()

  const before = await matches.estimatedDocumentCount()
  const nonPairs = await matches.countDocuments({ info: { $exists: true }, 'info.tft_game_type': { $ne: 'pairs' } })
  console.log(`[prune] ${before} matches total, ${nonPairs} non–Double Up to delete`)

  const del = await matches.deleteMany({ info: { $exists: true }, 'info.tft_game_type': { $ne: 'pairs' } })
  console.log(`[prune] deleted ${del.deletedCount} non–Double Up matches`)

  const backfill = await matches.updateMany(
    { gameDate: { $exists: false } },
    [{ $set: { gameDate: { $toDate: '$gameDatetime' } } }]
  )
  console.log(`[prune] backfilled gameDate on ${backfill.modifiedCount} matches`)

  console.log('[prune] (re)creating indexes…')
  await createIndexes()

  const after = await matches.estimatedDocumentCount()
  const stats = await matches.aggregate([
    { $group: { _id: null, bytes: { $sum: { $bsonSize: '$$ROOT' } } } }
  ]).toArray()
  const mb = stats[0] ? (stats[0].bytes / 1048576).toFixed(1) : '0.0'
  console.log(`[prune] done — ${after} matches remain, ~${mb}MB logical data`)

  await closeMongo()
  process.exit(0)
}

main().catch(err => {
  console.error('[prune] fatal:', err)
  process.exit(1)
})
