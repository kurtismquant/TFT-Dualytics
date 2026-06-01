// Diagnostic: verifies that each TFT patch's match filter is scoped to ONLY that
// patch (not later patches), using the SAME filter the comps/stats pages use.
//
// Run from the server/ directory:  node scripts/inspectPatches.js
import '../loadEnv.js'
import { connectMongo, getMatchesCollection, closeMongo } from '../db/mongo.js'
import { buildStatsMatchFilter, extractPatch, getAvailablePatches } from '../services/statsAggregator.js'

async function main() {
  await connectMongo()
  const matches = getMatchesCollection()
  if (!matches) {
    console.log('No matches collection available.')
    return
  }

  // 1) Raw distribution: how many Double Up matches exist per raw LoL game_version
  //    major.minor, and what TFT label each maps to.
  const base = buildStatsMatchFilter() // pairs + current set, no patch
  const docs = await matches
    .find(base, { projection: { _id: 0, 'info.game_version': 1 } })
    .toArray()

  const rawCounts = new Map()
  for (const d of docs) {
    const v = d.info?.game_version || ''
    const m = v.match(/(\d+)\.(\d+)/)
    const key = m ? `${m[1]}.${m[2]}` : '(none)'
    rawCounts.set(key, (rawCounts.get(key) || 0) + 1)
  }

  console.log(`\nTotal current-set Double Up matches: ${docs.length}`)
  console.log('\nRaw game_version major.minor -> count (TFT label):')
  for (const [raw, count] of [...rawCounts].sort((a, b) => b[1] - a[1])) {
    const tft = extractPatch(`Version ${raw}.0.0`) ?? '(not a current-set TFT patch)'
    console.log(`  ${raw.padEnd(8)} ${String(count).padStart(7)}   -> ${tft}`)
  }

  // 2) Per-TFT-patch counts using the EXACT filter the app uses. The sum of these
  //    should equal the total of the mapped rows above — if a patch's count is
  //    inflated, its filter is leaking later patches.
  const patches = await getAvailablePatches()
  console.log('\nPer-TFT-patch match count (via the app filter):')
  let sum = 0
  for (const p of patches) {
    const count = await matches.countDocuments(buildStatsMatchFilter(p))
    sum += count
    console.log(`  ${p.padEnd(8)} ${String(count).padStart(7)}   filter=${JSON.stringify(buildStatsMatchFilter(p)['info.game_version'])}`)
  }
  console.log(`  ${'sum'.padEnd(8)} ${String(sum).padStart(7)}   (should match the total of mapped rows above)`)
}

main()
  .catch(err => console.error('inspectPatches failed:', err))
  .finally(() => closeMongo())
