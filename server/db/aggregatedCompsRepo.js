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
  const all = await collection
    .find({}, { projection: { _id: 0 } })
    .toArray()
  const meta = all.find(d => d._type === 'meta')
  const totalMatches = meta?.matchCount ?? 0
  const comps = selectTopComps(all.filter(d => d._type !== 'meta'), totalMatches, limit)
  return { comps, matchCount: totalMatches }
}
