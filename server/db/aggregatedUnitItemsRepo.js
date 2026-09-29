import { getAggregatedUnitItemsCollection } from './mongo.js'

// Pre-aggregated 3-item combo tables for the current patch, one doc per (patch, unitId).
// Built by the comp-aggregation pass from the match docs it already pulled. Stored
// per unit so the unit stats route reads a few KB, not every unit's table, over the
// (remote Atlas) link.

// rows: [{ unitId, games, threeItemGames, combos: [...] }]
export async function replaceAggregatedUnitItems(patch, rows) {
  const collection = getAggregatedUnitItemsCollection()
  if (!collection || !patch) return
  const now = new Date()
  const ops = rows.map(row => ({
    updateOne: {
      filter: { patch, unitId: row.unitId },
      update: { $set: { patch, ...row, lastUpdated: now } },
      upsert: true,
    },
  }))
  if (ops.length) {
    try {
      await collection.bulkWrite(ops, { ordered: false })
    } catch (err) {
      // Two aggregation passes (e.g. cron + ingest) can race to first-insert the same
      // (patch, unitId) on the unique index, yielding E11000. Both writers hold identical
      // data, so the race is benign — swallow it and rethrow anything else.
      const isDuplicateKey = err?.code === 11000 ||
        err?.writeErrors?.every?.(e => e?.err?.code === 11000)
      if (!isDuplicateKey) throw err
    }
  }
  // Only the current patch is stored (older patches are aggregated on demand), so drop
  // previous patches' docs and units that no longer appear in this patch's matches.
  await collection.deleteMany({
    $or: [
      { patch: { $ne: patch } },
      { patch, unitId: { $nin: rows.map(row => row.unitId) } },
    ],
  })
}

export async function getAggregatedUnitItems(patch, unitId) {
  const collection = getAggregatedUnitItemsCollection()
  if (!collection || !patch || !unitId) return null
  return collection.findOne({ patch, unitId }, { projection: { _id: 0 } })
}
