import { getAggregatedItemUnitsCollection } from './mongo.js'

// Pre-aggregated "which units an item does best on" tables for the current patch,
// one doc per (patch, itemId). Built by the comp-aggregation pass from the match
// docs it already pulled, stored per item so the item stats route reads a few KB
// over the (remote Atlas) link.

// rows: [{ itemId, games, units: [...] }]
export async function replaceAggregatedItemUnits(patch, rows) {
  const collection = getAggregatedItemUnitsCollection()
  if (!collection || !patch) return
  const now = new Date()
  const ops = rows.map(row => ({
    updateOne: {
      filter: { patch, itemId: row.itemId },
      update: { $set: { patch, ...row, lastUpdated: now } },
      upsert: true,
    },
  }))
  if (ops.length) {
    try {
      await collection.bulkWrite(ops, { ordered: false })
    } catch (err) {
      // Two aggregation passes can race to first-insert the same (patch, itemId) on
      // the unique index (E11000). Both writers hold identical data, so it's benign.
      const isDuplicateKey = err?.code === 11000 ||
        err?.writeErrors?.every?.(e => e?.err?.code === 11000)
      if (!isDuplicateKey) throw err
    }
  }
  // Only the current patch is stored (older patches are aggregated on demand), so drop
  // previous patches' docs and items that no longer appear in this patch's matches.
  await collection.deleteMany({
    $or: [
      { patch: { $ne: patch } },
      { patch, itemId: { $nin: rows.map(row => row.itemId) } },
    ],
  })
}

export async function getAggregatedItemUnits(patch, itemId) {
  const collection = getAggregatedItemUnitsCollection()
  if (!collection || !patch || !itemId) return null
  return collection.findOne({ patch, itemId }, { projection: { _id: 0 } })
}
