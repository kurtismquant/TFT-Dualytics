import { getIngestionStateCollection } from './mongo.js'

// Single-document store for the ingestion daemon's round-robin progress.
// Lets the daemon resume from the next un-synced player after a pause/restart.
const STATE_ID = 'ingest'

export async function getIngestionState() {
  const collection = getIngestionStateCollection()
  if (!collection) return null
  return collection.findOne({ _id: STATE_ID })
}

export async function saveIngestionState({ region, pointerIndex, lastPuuid, cycle }) {
  const collection = getIngestionStateCollection()
  if (!collection) return
  await collection.updateOne(
    { _id: STATE_ID },
    { $set: { region, pointerIndex, lastPuuid, cycle, updatedAt: new Date() } },
    { upsert: true }
  )
}
