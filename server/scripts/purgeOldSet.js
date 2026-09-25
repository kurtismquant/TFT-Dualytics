// One-off cleanup after a set change: removes previous-set data and resets
// state so the current set is ingested cleanly. Dry run by default — prints
// what would change. Pass --confirm to apply.
//
// Run from the server/ directory:
//   node scripts/purgeOldSet.js            (dry run)
//   node scripts/purgeOldSet.js --confirm  (apply)
//
// What it does:
//   1. Deletes full match docs from any set other than CURRENT_SET.
//   2. Deletes stubs dated before the set release (their only job was dedup).
//   3. Deletes stubs dated after the set release. Before the Set 18 compat shim
//      (riotMatchCompat.js), Set 18 Double Up games failed the 'pairs' check and
//      were saved as stubs, which blocks them from ever being re-fetched.
//   4. Clears players' matchHistorySyncedThrough so the next sync re-lists match
//      ids from the set release and picks those games back up. Stored matchIds
//      arrays are cleared too; they are rebuilt as matches are re-stored.
//   5. Deletes aggregated_stats docs for patches outside the current set.
//   6. Clears aggregated_comps (the next aggregation pass rebuilds it).
//   7. Deletes rank snapshots recorded before the set release.
// players, leaderboards and ingestion_state are otherwise left as they are.
import '../loadEnv.js'
import {
  connectMongo,
  closeMongo,
  getMatchesCollection,
  getPlayersCollection,
  getAggregatedStatsCollection,
  getAggregatedCompsCollection,
  getRankSnapshotsCollection,
} from '../db/mongo.js'
import { CURRENT_SET, SET_RELEASE_MS } from '../constants/game.js'

const confirm = process.argv.includes('--confirm')

async function main() {
  await connectMongo()
  const matches = getMatchesCollection()
  const players = getPlayersCollection()
  const aggregatedStats = getAggregatedStatsCollection()
  const aggregatedComps = getAggregatedCompsCollection()
  const rankSnapshots = getRankSnapshotsCollection()
  if (!matches) {
    console.log('No database connection — nothing to do.')
    return
  }

  const releaseDate = new Date(SET_RELEASE_MS)
  const steps = [
    ['old-set match docs', matches, { stub: { $ne: true }, tftSetNumber: { $ne: CURRENT_SET } }],
    ['stubs before set release', matches, { stub: true, gameDatetime: { $lt: SET_RELEASE_MS } }],
    ['current-set stubs (re-fetch)', matches, { stub: true, gameDatetime: { $gte: SET_RELEASE_MS } }],
    ['aggregated_stats (other sets)', aggregatedStats, { patch: { $not: new RegExp(`^${CURRENT_SET}\\.`) } }],
    ['aggregated_comps', aggregatedComps, {}],
    ['rank snapshots before release', rankSnapshots, { recordedAt: { $lt: releaseDate } }],
  ]
  const cursorFilter = { $or: [{ matchHistorySyncedThrough: { $exists: true } }, { 'matchIds.0': { $exists: true } }] }

  console.log(`Set ${CURRENT_SET}, release ${releaseDate.toISOString()} — ${confirm ? 'APPLYING' : 'DRY RUN'}\n`)
  for (const [label, collection, filter] of steps) {
    if (!collection) continue
    const count = await collection.countDocuments(filter)
    if (confirm && count > 0) {
      const { deletedCount } = await collection.deleteMany(filter)
      console.log(`  ${label.padEnd(32)} deleted ${deletedCount}`)
    } else {
      console.log(`  ${label.padEnd(32)} ${count} to delete`)
    }
  }
  if (players) {
    const count = await players.countDocuments(cursorFilter)
    if (confirm && count > 0) {
      const { modifiedCount } = await players.updateMany(cursorFilter, {
        $unset: { matchHistorySyncedThrough: '' },
        $set: { matchIds: [] },
      })
      console.log(`  ${'player sync cursors'.padEnd(32)} reset ${modifiedCount}`)
    } else {
      console.log(`  ${'player sync cursors'.padEnd(32)} ${count} to reset`)
    }
  }
  if (!confirm) console.log('\nRe-run with --confirm to apply.')
}

main()
  .catch(err => {
    console.error('purgeOldSet failed:', err?.message)
    process.exitCode = 1
  })
  .finally(() => closeMongo())
