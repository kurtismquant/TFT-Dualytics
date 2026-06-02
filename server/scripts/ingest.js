import '../loadEnv.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectMongo, createIndexes, closeMongo } from '../db/mongo.js'
import { getLeaderboard } from '../db/leaderboardRepo.js'
import { getIngestionState, saveIngestionState } from '../db/ingestionStateRepo.js'
import { runLeaderboardAggregation } from '../services/leaderboardAggregator.js'
import { getPlayerMatches } from '../services/summonerMatches.js'
import { getCurrentPatchWindow } from '../services/statsAggregator.js'
import { runCompAggregation } from '../services/compsAggregator.js'
import { getPlatformRegion, getRateLimitStats, getTotalRequestCount } from '../services/riotApi.js'

// Continuous, pausable match-ingestion daemon. Round-robins through the top-N
// Double Up leaderboard players, syncing each player's new matches via the same
// rate-limited path the web app uses. Pause it (control file) while using the
// webpage — the personal Riot key is a single shared budget and this process has
// its own rate-limiter, so the two must not hit Riot at once.
//
//   Run:    npm run ingest -- [--region na1] [--top 50] [--stale-hours 24]
//                              [--idle-seconds 60] [--no-aggregate] [--all-patches]
//   By default only current-patch games are ingested; --all-patches backfills the whole set.
//   Pause:  npm run ingest:pause     (from another terminal)
//   Resume: npm run ingest:resume
//   Stop:   Ctrl-C (graceful — resumes where it left off on next start)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Must match the path written by ingest-control.js
const PAUSE_FILE = path.resolve(__dirname, '.ingest-paused')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

let stopping = false
let paused = false
let currentController = null

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (name, def) => {
    const i = args.indexOf(name)
    return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def
  }
  return {
    region: get('--region', process.env.REGION || 'na1'),
    top: parseInt(get('--top', '50'), 10),
    staleHours: parseInt(get('--stale-hours', '24'), 10),
    idleSeconds: parseInt(get('--idle-seconds', '60'), 10),
    noAggregate: args.includes('--no-aggregate'),
    currentPatchOnly: !args.includes('--all-patches'),
  }
}

// Poll the sentinel file; flipping to paused aborts any in-flight player sync so
// the daemon stops issuing Riot calls within ~1s and frees the key for the webpage.
function checkPause() {
  const exists = fs.existsSync(PAUSE_FILE)
  if (exists && !paused) {
    paused = true
    console.log('[ingest] paused — releasing the Riot key for the webpage')
    if (currentController) currentController.abort()
  } else if (!exists && paused) {
    paused = false
    console.log('[ingest] resumed')
  }
}

async function waitWhilePaused() {
  while (paused && !stopping) await sleep(1000)
}

async function idle(seconds) {
  for (let i = 0; i < seconds && !stopping; i++) await sleep(1000)
}

function installSignalHandlers() {
  const onSignal = (sig) => {
    if (stopping) return
    console.log(`\n[ingest] ${sig} received — stopping gracefully`)
    stopping = true
    if (currentController) currentController.abort()
  }
  process.on('SIGINT', () => onSignal('SIGINT'))
  process.on('SIGTERM', () => onSignal('SIGTERM'))
}

// Refresh the stored Double Up ladder if missing/stale, then return the top-N seeds.
async function ensureSeeds(platform, opts) {
  if (opts.top <= 0) return []
  let lb = await getLeaderboard(platform).catch(() => null)
  const staleMs = opts.staleHours * 3600_000
  const isStale = !lb?.entries?.length || !lb.updatedAt ||
    (Date.now() - new Date(lb.updatedAt).getTime() > staleMs)
  if (isStale && !stopping && !paused) {
    console.log('[ingest] leaderboard missing or stale — refreshing')
    await runLeaderboardAggregation(opts.region)
      .catch(err => console.error('[ingest] leaderboard refresh failed:', err.message))
    lb = await getLeaderboard(platform).catch(() => null)
  }
  return (lb?.entries || []).filter(e => e.gameName && e.tagLine).slice(0, opts.top)
}

// Sync one player. Returns 'ok' | 'error' | 'aborted'. An abort (pause/stop) is
// safe: stored matches are kept and the per-player cursor only advances on full
// completion, so a later retry just re-lists and skips already-known matches.
async function syncSeed(seed, platform, patchWindow) {
  currentController = new AbortController()
  try {
    await getPlayerMatches(seed.gameName, seed.tagLine, platform, currentController.signal, null, { currentPatch: patchWindow })
    return 'ok'
  } catch (err) {
    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return 'aborted'
    console.error(`[ingest] ${seed.gameName}#${seed.tagLine} failed: ${err.message}`)
    return 'error'
  } finally {
    currentController = null
  }
}

async function main() {
  const opts = parseArgs()
  if (!process.env.RIOT_API_KEY) {
    console.error('[ingest] RIOT_API_KEY is not set — aborting')
    process.exit(1)
  }

  await connectMongo()
  await createIndexes()
  const platform = getPlatformRegion(opts.region)
  console.log(`[ingest] starting for ${platform} — top ${opts.top}, idle ${opts.idleSeconds}s`)

  installSignalHandlers()
  paused = fs.existsSync(PAUSE_FILE)
  if (paused) console.log('[ingest] starting paused (control file present)')
  const watcher = setInterval(checkPause, 1000)

  const startCalls = getTotalRequestCount()

  // Resume the round-robin pointer (only if it belongs to this region).
  const state = await getIngestionState().catch(() => null)
  let pointerIndex = (state?.region === platform && Number.isInteger(state.pointerIndex)) ? state.pointerIndex : 0
  let cycle = state?.cycle ?? 0
  if (pointerIndex > 0) console.log(`[ingest] resuming at player #${pointerIndex} (cycle ${cycle})`)

  while (!stopping) {
    await waitWhilePaused()
    if (stopping) break

    const seeds = await ensureSeeds(platform, opts)
    if (seeds.length === 0) {
      console.log('[ingest] no seed players available — idling')
      await idle(opts.idleSeconds)
      continue
    }
    if (pointerIndex >= seeds.length) pointerIndex = 0

    // Resolve the current-patch window once per cycle (reflects patch transitions).
    // null window (no data yet, or --all-patches) → full-set ingest.
    let patchWindow = null
    if (opts.currentPatchOnly) {
      patchWindow = await getCurrentPatchWindow().catch(() => null)
      console.log(`[ingest] targeting patch ${patchWindow?.patch ?? '(none yet — full ingest to bootstrap)'}`)
    }

    while (pointerIndex < seeds.length && !stopping) {
      await waitWhilePaused()
      if (stopping) break

      const seed = seeds[pointerIndex]
      const result = await syncSeed(seed, platform, patchWindow)
      if (result === 'aborted') {
        // Paused or stopping — do not advance; the loop retries this seed on resume.
        continue
      }

      pointerIndex++
      await saveIngestionState({ region: platform, pointerIndex, lastPuuid: seed.puuid ?? null, cycle }).catch(() => {})
      const stats = getRateLimitStats()
      const runCalls = getTotalRequestCount() - startCalls
      console.log(`[ingest] [${pointerIndex}/${seeds.length}] ${seed.gameName}#${seed.tagLine} ${result} — ${stats.requestsLastMinute}/min, ${runCalls} calls this run`)
    }

    if (stopping) break

    // Full cycle complete — refresh comps (Mongo-only, no API) and idle briefly.
    cycle++
    pointerIndex = 0
    await saveIngestionState({ region: platform, pointerIndex, lastPuuid: null, cycle }).catch(() => {})
    if (!opts.noAggregate) {
      console.log('[ingest] cycle complete — running comp aggregation')
      await runCompAggregation().catch(err => console.error('[ingest] aggregation failed:', err.message))
    }
    console.log(`[ingest] cycle ${cycle} done — ${getTotalRequestCount() - startCalls} calls this run — idling ${opts.idleSeconds}s`)
    await idle(opts.idleSeconds)
  }

  clearInterval(watcher)
  console.log(`[ingest] shutting down — ${getTotalRequestCount() - startCalls} Riot calls this run`)
  await closeMongo().catch(() => {})
  process.exit(0)
}

main().catch(err => {
  console.error('[ingest] fatal:', err)
  process.exit(1)
})
