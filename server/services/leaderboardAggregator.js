import { riotRequest, getMassRegion, getPlatformRegion } from './riotApi.js'
import { replaceLeaderboard, getLeaderboard } from '../db/leaderboardRepo.js'

const QUEUE = 'RANKED_TFT_DOUBLE_UP'
const TARGET = 300
const DIVISIONS = ['I', 'II', 'III', 'IV']
const PAGED_TIERS = ['DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD']

// When a refresh hits this many auth failures (401/403), treat the whole run as a
// key outage: abandon it rather than overwriting a previously-good ladder with the
// handful of entries that happened to slip through. Tolerates 1-2 transient blips.
const AUTH_FAIL_ABORT_THRESHOLD = 5
// After a failed/empty run, don't relaunch for the same platform within this window.
// Bounds a persistent-401 situation to one failing run per region per cooldown instead
// of a continuous loop driven by client polling.
const RETRY_COOLDOWN_MS = 10 * 60 * 1000

const inFlight = new Map()
// platform -> { at: epoch ms, outcome: 'success' | 'failure' }. Drives isRetryCoolingDown.
const lastAttempt = new Map()

function recordAttempt(platform, outcome) {
  lastAttempt.set(platform, { at: Date.now(), outcome })
}

function platformHost(platform) {
  return `https://${platform}.api.riotgames.com`
}

function regionalHost(mass) {
  return `https://${mass}.api.riotgames.com`
}

async function fetchApexTier(platform, tier) {
  const url = `${platformHost(platform)}/tft/league/v1/${tier}?queue=${QUEUE}`
  const data = await riotRequest(url)
  const tierName = tier === 'challenger' ? 'CHALLENGER' : tier === 'grandmaster' ? 'GRANDMASTER' : 'MASTER'
  return (data?.entries || [])
    .map(e => ({
      puuid: e.puuid,
      tier: tierName,
      division: 'I',
      lp: e.leaguePoints ?? 0,
      wins: e.wins ?? 0,
      losses: e.losses ?? 0,
    }))
    .sort((a, b) => b.lp - a.lp)
}

async function fetchPagedDivision(platform, tier, division) {
  const out = []
  for (let page = 1; page < 50; page++) {
    const url = `${platformHost(platform)}/tft/league/v1/entries/${tier}/${division}?queue=${QUEUE}&page=${page}`
    const data = await riotRequest(url)
    if (!Array.isArray(data) || data.length === 0) break
    for (const e of data) {
      out.push({
        puuid: e.puuid,
        tier,
        division,
        lp: e.leaguePoints ?? 0,
        wins: e.wins ?? 0,
        losses: e.losses ?? 0,
      })
    }
    if (data.length < 200) break
  }
  return out.sort((a, b) => b.lp - a.lp)
}

async function resolveAccount(massRegion, puuid) {
  const url = `${regionalHost(massRegion)}/riot/account/v1/accounts/by-puuid/${puuid}`
  try {
    const data = await riotRequest(url)
    return { gameName: data?.gameName || null, tagLine: data?.tagLine || null }
  } catch (err) {
    return { gameName: null, tagLine: null }
  }
}

export async function runLeaderboardAggregation(regionInput) {
  const platform = getPlatformRegion(regionInput)
  const mass = getMassRegion(platform)

  if (inFlight.has(platform)) return inFlight.get(platform)

  const job = (async () => {
    console.log(`[leaderboard] starting refresh for ${platform}`)
    const collected = []
    let authFailures = 0

    for (const apex of ['challenger', 'grandmaster', 'master']) {
      if (collected.length >= TARGET) break
      try {
        const entries = await fetchApexTier(platform, apex)
        console.log(`[leaderboard] ${platform} ${apex}: ${entries.length} entries (running total ${collected.length + entries.length})`)
        collected.push(...entries)
      } catch (err) {
        // The apex league endpoints occasionally hiccup (transient 404/timeout/429).
        // Without a fallback this silently dropped a whole tier from the stored ladder.
        // Retry via the paged entries endpoint, which exposes the same apex players
        // under uppercase tier + division 'I' and returns the identical entry shape.
        console.warn(`[leaderboard] ${platform} ${apex} league endpoint failed (${err.response?.status ?? err.message}) — retrying via entries endpoint`)
        try {
          const entries = await fetchPagedDivision(platform, apex.toUpperCase(), 'I')
          console.log(`[leaderboard] ${platform} ${apex}: ${entries.length} entries (entries-endpoint fallback, running total ${collected.length + entries.length})`)
          collected.push(...entries)
        } catch (fallbackErr) {
          if (fallbackErr.isAuthError) authFailures += 1
          console.error(`[leaderboard] ${platform} ${apex} entries fallback also failed:`, fallbackErr.response?.status || '', fallbackErr.message)
        }
      }
    }

    outer: for (const tier of PAGED_TIERS) {
      for (const div of DIVISIONS) {
        if (collected.length >= TARGET) break outer
        try {
          const entries = await fetchPagedDivision(platform, tier, div)
          console.log(`[leaderboard] ${platform} ${tier} ${div}: ${entries.length} entries (running total ${collected.length + entries.length})`)
          collected.push(...entries)
        } catch (err) {
          if (err.isAuthError) authFailures += 1
          console.error(`[leaderboard] ${platform} ${tier} ${div} fetch failed:`, err.response?.status || '', err.message)
        }
      }
    }
    console.log(`[leaderboard] ${platform} aggregation finished collecting: ${collected.length} total entries`)

    const top = collected.slice(0, TARGET)

    if (top.length === 0) {
      console.warn(`[leaderboard] ${platform} aggregation collected 0 entries — Riot API may have no Double Up data for this region. Skipping DB write so a retry can occur.`)
      recordAttempt(platform, 'failure')
      return []
    }

    // A run dominated by auth failures (a key outage / edge 401 storm) only collected
    // the few entries that slipped through. Don't let that overwrite a good ladder —
    // abandon the run and keep serving the previously stored entries.
    if (authFailures >= AUTH_FAIL_ABORT_THRESHOLD) {
      console.warn(`[leaderboard] ${platform} aggregation hit ${authFailures} auth failures — abandoning refresh to preserve the existing ladder`)
      recordAttempt(platform, 'failure')
      const existing = await getLeaderboard(platform)
      return existing?.entries ?? []
    }

    const accounts = await Promise.all(top.map(e => resolveAccount(mass, e.puuid)))
    const entries = top.map((e, i) => ({
      rank: i + 1,
      puuid: e.puuid,
      gameName: accounts[i].gameName,
      tagLine: accounts[i].tagLine,
      tier: e.tier,
      division: e.division,
      lp: e.lp,
      wins: e.wins,
      losses: e.losses,
    }))

    await replaceLeaderboard(platform, entries)
    console.log(`[leaderboard] ${platform} refreshed with ${entries.length} entries`)
    recordAttempt(platform, 'success')
    return entries
  })()
    .catch(err => {
      console.error(`[leaderboard] ${platform} refresh failed:`, err.message)
      recordAttempt(platform, 'failure')
      return null
    })
    .finally(() => {
      inFlight.delete(platform)
    })

  inFlight.set(platform, job)
  return job
}

export function isRefreshing(regionInput) {
  return inFlight.has(getPlatformRegion(regionInput))
}

// True while a recent failed/empty run is still within its cooldown — callers use this
// to skip relaunching a doomed refresh. A successful run clears the cooldown (its fresh
// updatedAt is gated by the caller's normal staleness window instead).
export function isRetryCoolingDown(regionInput) {
  const last = lastAttempt.get(getPlatformRegion(regionInput))
  if (!last || last.outcome === 'success') return false
  return Date.now() - last.at < RETRY_COOLDOWN_MS
}
