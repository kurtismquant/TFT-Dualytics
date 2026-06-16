import { getAggregatedCompsCollection } from './mongo.js'

export async function replaceAggregatedComps(comps, matchCount = 0) {
  const collection = getAggregatedCompsCollection()
  if (!collection) return
  const now = new Date()
  await collection.deleteMany({})
  const docs = [
    { _type: 'meta', matchCount, lastUpdated: now },
    ...comps.map(c => ({ ...c, lastUpdated: now })),
  ]
  await collection.insertMany(docs)
}

// Comps shown to users must clear this share of total matches to filter out noise.
export const MIN_PLAY_RATE = 0.02

// Applies the play-rate floor, the canonical sort, and the limit. Shared by the
// stored (Mongo) read path and the on-demand per-patch aggregation path so both
// return the same shape.
// note 
export function selectTopComps(comps, totalMatches, limit = 20) {
  const sorted = comps
    .filter(d => totalMatches > 0 && d.playCount / totalMatches > MIN_PLAY_RATE)
    .sort((a, b) => b.playCount - a.playCount || a.avgPlacement - b.avgPlacement)
  const resolvedLimit = Number.isFinite(limit) ? limit : 20
  return resolvedLimit > 0 ? sorted.slice(0, resolvedLimit) : sorted
}

export async function getAggregatedComps(limit = 20) {
  const collection = getAggregatedCompsCollection()
  if (!collection) return { comps: [], matchCount: 0 }

  // Read the small meta doc first for the total match count, then let Mongo apply the
  // play-rate floor, canonical sort, and limit server-side. The previous version pulled
  // every stored comp (hundreds of multi-KB docs) over the wire and filtered in JS —
  // slow against a remote (Atlas) cluster, and wasteful when only `limit` are shown.
  const meta = await collection.findOne({ _type: 'meta' }, { projection: { _id: 0, matchCount: 1 } })
  const totalMatches = meta?.matchCount ?? 0
  if (totalMatches <= 0) return { comps: [], matchCount: 0 }

  // selectTopComps keeps comps with playCount / totalMatches > MIN_PLAY_RATE and sorts
  // by playCount desc, then avgPlacement asc. Express that same floor and order as a
  // server-side query (the playCount:-1 index covers it) so non-qualifying comps never
  // transfer. Kept identical to selectTopComps so the on-demand patch path still matches.
  const cursor = collection
    .find(
      { _type: { $ne: 'meta' }, playCount: { $gt: MIN_PLAY_RATE * totalMatches } },
      { projection: { _id: 0 } }
    )
    .sort({ playCount: -1, avgPlacement: 1 })
  if (Number.isFinite(limit) && limit > 0) cursor.limit(limit)

  const comps = await cursor.toArray()
  return { comps, matchCount: totalMatches }
}
