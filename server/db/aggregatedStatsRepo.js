import { getAggregatedStatsCollection } from './mongo.js'

// Pre-aggregated unit/item/trait stats for the current patch, keyed by (patch, type).
// Built once per aggregation pass from the same match docs the comp aggregator pulls,
// so getStats can serve the Stats tables without re-streaming ~20MB of raw matches
// over the (remote Atlas) link on every request.

// statsByType: { units: {rows, matchCount, participantCount, itemCount}, items: {...}, traits: {...} }
export async function replaceAggregatedStats(patch, statsByType) {
  const collection = getAggregatedStatsCollection()
  if (!collection || !patch) return
  const now = new Date()
  const ops = Object.entries(statsByType).map(([type, value]) => ({
    updateOne: {
      filter: { patch, type },
      update: { $set: { patch, type, ...value, lastUpdated: now } },
      upsert: true,
    },
  }))
  if (!ops.length) return
  try {
    await collection.bulkWrite(ops)
  } catch (err) {
    // Two aggregation passes (e.g. cron + ingest) can race to first-insert the same
    // (patch, type) on the unique index, yielding E11000. The losing writer's data is
    // identical to the winner's, so the race is benign — swallow it and rethrow anything
    // else. Once the doc exists, subsequent writes are plain updates with no race.
    const isDuplicateKey = err?.code === 11000 ||
      err?.writeErrors?.every?.(e => e?.err?.code === 11000)
    if (!isDuplicateKey) throw err
  }
}

export async function getAggregatedStats(patch, type) {
  const collection = getAggregatedStatsCollection()
  if (!collection || !patch) return null
  return collection.findOne({ patch, type }, { projection: { _id: 0 } })
}
