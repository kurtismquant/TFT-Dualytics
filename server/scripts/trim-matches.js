import '../loadEnv.js'
import { connectMongo, closeMongo, getMatchesCollection } from '../db/mongo.js'
import { buildMatchDocument } from '../db/matchRepo.js'

// One-time migration: rewrite every stored Double Up match into the trimmed shape
// produced by buildMatchDocument (drops augments/companion/missions/gold_left, the
// duplicated flat-participant payload, and metadata beyond match_id). ~56% smaller.
//
// Idempotent: buildMatchDocument reproduces the same shape when run on an
// already-trimmed doc, so re-running this is a no-op in size.

const BATCH = 500

async function main() {
  const db = await connectMongo()
  const matches = getMatchesCollection()

  const before = (await db.command({ dbStats: 1 })).dataSize
  const total = await matches.countDocuments({ stub: { $ne: true } })
  console.log(`[trim] ${total} Double Up matches to rewrite — cluster dataSize ${(before / 1048576).toFixed(0)}MB`)

  const cursor = matches.find({ stub: { $ne: true } })
  let ops = []
  let done = 0

  const flush = async () => {
    if (!ops.length) return
    await matches.bulkWrite(ops, { ordered: false })
    done += ops.length
    ops = []
    process.stdout.write(`\r[trim] rewritten ${done}/${total}`)
  }

  for await (const doc of cursor) {
    const trimmed = buildMatchDocument(doc)
    trimmed.lastUpdated = doc.lastUpdated ?? new Date()
    ops.push({ replaceOne: { filter: { matchId: doc.matchId }, replacement: trimmed } })
    if (ops.length >= BATCH) await flush()
  }
  await flush()
  process.stdout.write('\n')

  const after = (await db.command({ dbStats: 1 })).dataSize
  console.log(`[trim] done — cluster dataSize ${(before / 1048576).toFixed(0)}MB → ${(after / 1048576).toFixed(0)}MB (freed ${((before - after) / 1048576).toFixed(0)}MB)`)

  await closeMongo()
  process.exit(0)
}

main().catch(err => {
  console.error('\n[trim] fatal:', err)
  process.exit(1)
})
