// Diagnostic: verifies that each TFT patch's match filter is scoped to ONLY that
// patch (not later patches), using the SAME filter the comps/stats pages use.
//
// Run from the server/ directory:  node scripts/inspectPatches.js
import '../loadEnv.js'
import { connectMongo, getMatchesCollection, closeMongo } from '../db/mongo.js'
import { buildStatsMatchFilter, getAvailablePatches } from '../services/statsAggregator.js'
import { SET_PATCH_SCHEDULE } from '../constants/game.js'

async function main() {
  await connectMongo()
  const matches = getMatchesCollection()
  if (!matches) {
    console.log('No matches collection available.')
    return
  }

  // 1) Total current-set Double Up matches, counted server-side.
  const total = await matches.countDocuments(buildStatsMatchFilter())
  console.log(`\nTotal current-set Double Up matches: ${total}`)
  console.log('\nPatch schedule (gameDatetime windows, UTC):')
  for (const entry of SET_PATCH_SCHEDULE) {
    console.log(`  ${entry.patch.padEnd(8)} from ${new Date(entry.startsAt).toISOString()}`)
  }

  // 2) Per-TFT-patch counts using the EXACT filter the app uses. The sum should
  //    equal the total above minus any games before the first scheduled patch —
  //    if a patch's count is inflated, its window is leaking into another patch.
  const patches = await getAvailablePatches()
  console.log('\nPer-TFT-patch match count (via the app filter):')
  let sum = 0
  for (const p of patches) {
    const filter = buildStatsMatchFilter(p)
    const count = await matches.countDocuments(filter)
    sum += count
    console.log(`  ${p.padEnd(8)} ${String(count).padStart(7)}   window=${JSON.stringify(filter.gameDatetime)}`)
  }
  console.log(`  ${'sum'.padEnd(8)} ${String(sum).padStart(7)}   (should equal the total above)`)
}

main()
  .catch(err => console.error('inspectPatches failed:', err))
  .finally(() => closeMongo())
