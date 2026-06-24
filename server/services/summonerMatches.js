import { riotRequest, getMassRegion, getAccountRegion, getPlatformRegion, getRateLimitStats } from './riotApi.js'
import { normalizeMatch } from './matchNormalizers.js'
import {
  findPlayerByRiotId,
  findPlayersByPuuids,
  upsertPlayer,
  addMatchIdsToPlayer,
  updatePlayerRank,
  markMatchHistorySynced,
  upsertPartner,
} from '../db/playerRepo.js'
import {
  findMatchesByPuuid,
  filterKnownMatchIds,
  getLatestMatchTimestamp,
  upsertMatch,
  buildMatchDocument,
  buildMatchStub,
} from '../db/matchRepo.js'
import {
  findRankSnapshots,
  recordRankSnapshotIfChanged,
} from '../db/rankSnapshotsRepo.js'
import { extractPatch, patchToNum } from './statsAggregator.js'
import { CURRENT_SET as DEFAULT_CURRENT_SET } from '../constants/game.js'

const USER_PRIORITY = 10
const CURRENT_SET = Number(process.env.CURRENT_SET || DEFAULT_CURRENT_SET)
const SET_RELEASE = Number(process.env.CURRENT_SET_RELEASE_TIMESTAMP)
// Rank snapshots are not stored per-set, so clip them to the current set's
// release. This prevents a previous-set snapshot (before the soft MMR reset)
// from forming a huge artificial LP delta with the first current-set snapshot.
const SET_RELEASE_MS = Number.isFinite(SET_RELEASE) ? SET_RELEASE * 1000 : null
const IDS_PAGE_SIZE = 100
const MAX_PAGES = 50
const SYNC_STATUS_TTL = 10 * 60 * 1000
const SYNC_RESTART_DELAY = 60 * 1000
const MATCH_SYNC_OVERLAP_SECONDS = 24 * 60 * 60
// Safe slack subtracted from a patch's earliest-seen game when lower-bounding the
// match-id listing for current-patch ingestion. The sentinel early-stop is the
// exact cutoff, so this only needs to avoid clipping genuine early-patch games.
const PATCH_START_BUFFER_SEC = 6 * 60 * 60

const VALID_TAG_LINE = /^[a-zA-Z0-9]{2,5}$/
const syncJobs = new Map()

function syncKey(region, gameName, tagLine) {
  return `${region?.toLowerCase() || 'na1'}:${gameName.trim().toLowerCase()}#${tagLine.trim().toLowerCase()}`
}

function touchSync(job, fields) {
  if (!job) return
  Object.assign(job, fields, { updatedAt: Date.now() })
}

function estimateSyncEtaSeconds(job) {
  if (!job || job.state !== 'syncing') return 0
  const stats = getRateLimitStats()
  const remainingDetails = Math.max(0, (job.totalNewMatches ?? 0) - (job.processedNewMatches ?? 0))
  const unknownWork = job.totalNewMatches == null ? 3 : 0
  const remainingRequests = Math.max(1, remainingDetails + unknownWork + (job.phase === 'rank' ? 1 : 0))
  const queuedRequests = stats.queuedRequests + stats.inFlightRequests
  // Details are enqueued in parallel, so this job's remaining requests usually
  // ARE the queued ones — max() instead of sum avoids double counting.
  const totalOutstanding = Math.max(queuedRequests, remainingRequests)
  // Within one 100-req/2min window the 20/sec short queue is the only
  // constraint; beyond it, the sustained long-window rate (~50/min) dominates.
  if (totalOutstanding <= 100) return Math.max(5, Math.ceil(totalOutstanding / 20))
  return Math.max(10, Math.ceil((totalOutstanding / 50) * 60))
}

function publicSyncStatus(job) {
  if (!job) {
    return {
      state: 'idle',
      phase: 'idle',
      message: 'USING STORED MATCH DATA',
      etaSeconds: 0,
      processedNewMatches: 0,
      totalNewMatches: 0,
    }
  }

  const status = {
    state: job.state,
    phase: job.phase,
    message: job.message,
    etaSeconds: estimateSyncEtaSeconds(job),
    processedNewMatches: job.processedNewMatches ?? 0,
    totalNewMatches: job.totalNewMatches ?? null,
    matchIdsFound: job.matchIdsFound ?? null,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt ?? null,
  }
  if (job.error) status.error = job.error
  return status
}

export function getPlayerSyncStatus(region, gameName, tagLine) {
  return publicSyncStatus(syncJobs.get(syncKey(region, gameName, tagLine)))
}

export function validateRiotId(gameName, tagLine) {
  if (!gameName || !tagLine) {
    throw Object.assign(new Error('Riot ID requires gameName#tagLine'), { statusCode: 400 })
  }
  if (gameName.length < 3 || gameName.length > 16 || gameName.includes('#') || gameName.includes('/')) {
    throw Object.assign(new Error('Invalid game name'), { statusCode: 400 })
  }
  if (!VALID_TAG_LINE.test(tagLine)) {
    throw Object.assign(new Error('Invalid tag line'), { statusCode: 400 })
  }
}

function rankInfoFromPlayer(dbPlayer) {
  if (!dbPlayer?.tier) return null
  return {
    tier: dbPlayer.tier,
    rank: dbPlayer.rank,
    leaguePoints: dbPlayer.leaguePoints,
    updatedAt: dbPlayer.rankUpdatedAt ?? null,
  }
}

async function buildParticipantRanks(matches, rankInfo, puuid) {
  const participantPuuids = matches.flatMap(match =>
    (match.allParticipants || []).map(participant => participant.puuid)
  )
  const dbPlayers = await findPlayersByPuuids(participantPuuids).catch(() => [])
  const participantRanks = {}

  for (const player of dbPlayers) {
    const info = rankInfoFromPlayer(player)
    if (info) participantRanks[player.puuid] = info
  }

  if (puuid && rankInfo) participantRanks[puuid] = rankInfo
  return participantRanks
}

async function buildStoredPlayerResponse(dbPlayer, gameName, tagLine) {
  if (!dbPlayer?.puuid) return null
  const matchDocs = await findMatchesByPuuid(dbPlayer.puuid, 0).catch(() => [])
  const matches = matchDocs
    .map(doc => normalizeMatch(doc, dbPlayer.puuid, CURRENT_SET))
    .filter(Boolean)
    .sort((a, b) => b.date - a.date)

  const rankInfo = rankInfoFromPlayer(dbPlayer)
  const rankSnapshots = await findRankSnapshots(dbPlayer.puuid, { sinceMs: SET_RELEASE_MS }).catch(() => [])

  return {
    summoner: {
      gameName: dbPlayer.accountDetails?.gameName ?? gameName,
      tagLine: dbPlayer.accountDetails?.tagLine ?? tagLine,
      puuid: dbPlayer.puuid,
    },
    matches,
    rankInfo,
    rankSnapshots,
    participantRanks: await buildParticipantRanks(matches, rankInfo, dbPlayer.puuid),
    cache: {
      source: 'mongo',
      matchCount: matches.length,
      lastMatchAt: matches[0]?.date ?? null,
      lastUpdated: dbPlayer.matchHistorySyncedAt ?? null,
    },
  }
}

export async function getStoredPlayerMatches(gameName, tagLine) {
  validateRiotId(gameName, tagLine)
  const gameNameLower = gameName.trim().toLowerCase()
  const tagLineLower = tagLine.trim().toLowerCase()
  const dbPlayer = await findPlayerByRiotId(gameNameLower, tagLineLower).catch(() => null)
  return buildStoredPlayerResponse(dbPlayer, gameName, tagLine)
}

// Paginate Riot's match-ids endpoint to collect all match IDs since startTimeSec.
// Stops when a page returns fewer than IDS_PAGE_SIZE results (last page reached).
async function paginateMatchIds(puuid, massRegion, startTimeSec, signal, syncJob = null, priority = USER_PRIORITY) {
  const allIds = []
  for (let page = 0; page < MAX_PAGES; page++) {
    touchSync(syncJob, {
      phase: 'match-ids',
      message: 'CHECKING RIOT FOR NEW MATCH IDS',
      matchIdsFound: allIds.length,
    })
    const start = page * IDS_PAGE_SIZE
    const url = `https://${massRegion}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?startTime=${startTimeSec}&start=${start}&count=${IDS_PAGE_SIZE}`
    let ids
    try {
      ids = await riotRequest(url, priority, signal)
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') throw err
      console.error('[paginateMatchIds] failed while fetching match ids', err?.message)
      throw err
    }
    if (!Array.isArray(ids) || ids.length === 0) break
    allIds.push(...ids)
    touchSync(syncJob, { matchIdsFound: allIds.length })
    if (ids.length < IDS_PAGE_SIZE) break
  }
  return allIds
}

// Store a fetched match detail. Only Double Up matches are aggregated or shown
// in history; non-pairs are stored as a tiny stub so they dedup in
// filterKnownMatchIds (never re-fetched) without keeping the full ~40KB payload.
async function storeMatchDetail(detail, matchId, puuid) {
  const isDoubleUp = detail.info?.tft_game_type === 'pairs'
  const matchDoc = isDoubleUp ? buildMatchDocument(detail) : buildMatchStub(detail)
  try {
    const { inserted } = await upsertMatch(matchDoc)
    if (inserted && isDoubleUp) {
      const allPuuids = (detail.info?.participants ?? []).map(p => p.puuid).filter(Boolean)
      for (const pPuuid of allPuuids) {
        addMatchIdsToPlayer(pPuuid, [matchId]).catch(() => {})
      }
      const self = detail.info?.participants?.find(p => p.puuid === puuid)
      const partner = detail.info?.participants?.find(
        p => p.puuid !== puuid && p.partner_group_id === self?.partner_group_id
      )
      if (partner?.puuid) {
        upsertPartner(puuid, partner.puuid, new Date(detail.info.game_datetime)).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[getPlayerMatches] failed to store match', matchId, err?.message)
    throw err
  }
}

async function fetchRankInfo(puuid, region, signal, priority = USER_PRIORITY) {
  try {
    const platform = getPlatformRegion(region)
    const entries = await riotRequest(
      `https://${platform}.api.riotgames.com/tft/league/v1/by-puuid/${puuid}`,
      priority,
      signal
    )
    const list = Array.isArray(entries) ? entries : (entries ? [entries] : [])
    const ranked = list.find(e => e.queueType === 'RANKED_TFT_DOUBLE_UP') || null
    if (!ranked?.tier) {
      updatePlayerRank(puuid, { tier: null, rank: null, leaguePoints: null }).catch(() => {})
      return null
    }
    const result = {
      tier: ranked.tier,
      rank: ranked.rank,
      leaguePoints: ranked.leaguePoints,
      updatedAt: new Date(),
    }
    updatePlayerRank(puuid, { tier: ranked.tier, rank: ranked.rank, leaguePoints: ranked.leaguePoints }).catch(() => {})
    recordRankSnapshotIfChanged(puuid, {
      tier: ranked.tier,
      rank: ranked.rank,
      leaguePoints: ranked.leaguePoints,
      recordedAt: result.updatedAt,
    }).catch(() => {})
    return result
  } catch (err) {
    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') throw err
    console.error('[fetchRankInfo] failed for', puuid, err?.message)
    return null
  }
}

export async function getPlayerMatches(gameName, tagLine, region, signal, syncJob = null, options = {}) {
  validateRiotId(gameName, tagLine)
  // When options.currentPatch is set (daemon ingestion), restrict to current-patch
  // games: lower-bound the id listing by the patch start and stop the detail loop
  // at the first older-patch game. Default (web lookups) keeps full current-set behavior.
  const currentPatch = options.currentPatch ?? null
  // Background callers (cron/daemon) must pass a lower priority so queued user
  // lookups always jump ahead of them in the shared rate-limit queue.
  const priority = options.priority ?? USER_PRIORITY
  touchSync(syncJob, {
    phase: 'resolving',
    message: 'RESOLVING STORED PLAYER PROFILE',
  })
  const massRegion = getMassRegion(region)
  const gameNameLower = gameName.trim().toLowerCase()
  const tagLineLower = tagLine.trim().toLowerCase()

  // 1. DB-first player lookup — skip Riot Account API if we already have the puuid
  let dbPlayer = await findPlayerByRiotId(gameNameLower, tagLineLower).catch(() => null)
  let puuid = dbPlayer?.puuid
  let resolvedGameName = dbPlayer?.accountDetails?.gameName ?? gameName
  let resolvedTagLine = dbPlayer?.accountDetails?.tagLine ?? tagLine

  if (!puuid) {
    touchSync(syncJob, {
      phase: 'account',
      message: 'WAITING FOR RIOT ACCOUNT LOOKUP',
    })
    const encGame = encodeURIComponent(gameName.trim())
    const encTag = encodeURIComponent(tagLine.trim())
    // account-v1 has no `sea` cluster (it 403s) — route via getAccountRegion, not the
    // match-v1 massRegion used below for /tft/match/v1.
    const account = await riotRequest(
      `https://${getAccountRegion(region)}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encGame}/${encTag}`,
      priority,
      signal
    )
    puuid = account.puuid
    resolvedGameName = account.gameName
    resolvedTagLine = account.tagLine
    await upsertPlayer(puuid, {
      gameNameLower,
      tagLineLower,
      accountDetails: { gameName: account.gameName, tagLine: account.tagLine },
      lastUpdated: new Date(),
    })
  }

  touchSync(syncJob, {
    phase: 'match-ids',
    message: 'CHECKING RIOT FOR NEW MATCH IDS',
  })

  // 2. Determine start time from the last successfully completed cursor.
  // Partial newest-first writes do not advance this value, so the next sync
  // rechecks the unfinished window and cannot skip older unprocessed matches.
  const syncedThroughMs = dbPlayer?.matchHistorySyncedThrough ?? null
  let startTimeSec = syncedThroughMs
    ? Math.max(SET_RELEASE, Math.floor(syncedThroughMs / 1000) - MATCH_SYNC_OVERLAP_SECONDS)
    : SET_RELEASE
  // Current-patch lower bound: never list older than the patch start (minus slack).
  // max() with the cursor means a caught-up player still lists only new games.
  if (currentPatch?.startMs) {
    startTimeSec = Math.max(startTimeSec, Math.floor(currentPatch.startMs / 1000) - PATCH_START_BUFFER_SEC)
  }

  // 3. Paginate all match IDs since start time (up to MAX_PAGES * IDS_PAGE_SIZE)
  const allIds = await paginateMatchIds(puuid, massRegion, startTimeSec, signal, syncJob, priority)

  // 4. Filter out match IDs already in the database (safety net for edge cases)
  const knownInDb = await filterKnownMatchIds(allIds).catch(() => new Set())
  const newIds = allIds.filter(id => !knownInDb.has(id))
  touchSync(syncJob, {
    phase: newIds.length > 0 ? 'details' : 'rank',
    message: newIds.length > 0 ? 'FETCHING NEW MATCH DETAILS' : 'MATCH CACHE IS CURRENT',
    matchIdsFound: allIds.length,
    totalNewMatches: newIds.length,
    processedNewMatches: 0,
  })

  // 5. Fetch details for new matches only, upsert to MongoDB.
  let processedNewMatches = 0
  const detailUrl = (matchId) =>
    `https://${massRegion}.api.riotgames.com/tft/match/v1/matches/${matchId}`

  if (currentPatch || priority < USER_PRIORITY) {
    // Sequential path. Current-patch ingestion needs it because newIds is
    // newest-first and we raise a recency threshold to the newest patch this
    // player has played (>= the DB's current patch — this is what lets a
    // just-dropped patch self-heal), stopping at the first older game.
    // Background syncs need it because bulk-enqueueing a whole backlog would
    // flood the shared queue, stalling user lookups that arrive later
    // (the scheduler is FIFO within a priority) and distorting their ETAs.
    let patchThreshold = currentPatch?.patchNum ?? null
    for (const matchId of newIds) {
      if (signal?.aborted) break
      let detail
      try {
        detail = await riotRequest(detailUrl(matchId), priority, signal)
      } catch (err) {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') throw err
        console.error('[getPlayerMatches] failed to fetch match', matchId, err?.message)
        throw err
      }

      // Sentinel early-stop: store the first older-patch game as a stub (so it
      // dedups and is never re-fetched) and stop.
      if (currentPatch) {
        const pNum = patchToNum(extractPatch(detail.info?.game_version))
        if (pNum == null || (patchThreshold != null && pNum < patchThreshold)) {
          await upsertMatch(buildMatchStub(detail)).catch(() => {})
          break
        }
        if (patchThreshold == null || pNum > patchThreshold) patchThreshold = pNum
      }

      await storeMatchDetail(detail, matchId, puuid)
      processedNewMatches += 1
      touchSync(syncJob, {
        phase: 'details',
        message: 'FETCHING NEW MATCH DETAILS',
        processedNewMatches,
      })
    }
  } else {
    // Web lookups: enqueue every detail fetch at once. The shared rate-limit
    // scheduler in riotApi.js is the only throttle that matters (20/sec,
    // 100/2min) — awaiting sequentially here would just serialize round-trip
    // latency without saving any rate budget.
    const detailAbort = new AbortController()
    if (signal) {
      if (signal.aborted) detailAbort.abort()
      else signal.addEventListener('abort', () => detailAbort.abort(), { once: true })
    }
    const results = await Promise.allSettled(newIds.map(async (matchId) => {
      try {
        const detail = await riotRequest(detailUrl(matchId), priority, detailAbort.signal)
        await storeMatchDetail(detail, matchId, puuid)
      } catch (err) {
        if (err?.name !== 'AbortError' && err?.code !== 'ERR_CANCELED') {
          console.error('[getPlayerMatches] failed to fetch match', matchId, err?.message)
          // Drop the remaining queued fetches so they don't burn rate budget.
          detailAbort.abort()
        }
        throw err
      }
      processedNewMatches += 1
      touchSync(syncJob, {
        phase: 'details',
        message: 'FETCHING NEW MATCH DETAILS',
        processedNewMatches,
      })
    }))
    // First real failure fails the sync, matching the old sequential behavior.
    // Aborts (including the outer signal firing) just end the loop early.
    const failure = results.find(r => r.status === 'rejected' && r.reason?.name !== 'AbortError')
    if (failure) throw failure.reason
  }

  touchSync(syncJob, {
    phase: 'rank',
    message: 'REFRESHING DOUBLE UP RANK',
  })

  // Match detail payloads do not include rank. The TFT League endpoint is the
  // exact source for current Double Up rank, so refresh it on every sync.
  const rankInfo = await fetchRankInfo(puuid, region, signal, priority)

  const syncedAt = new Date()
  const latestAfterSync = await getLatestMatchTimestamp(puuid).catch(() => null)
  await markMatchHistorySynced(puuid, syncedAt, latestAfterSync ?? syncedAt.getTime())

  touchSync(syncJob, {
    phase: 'loading-cache',
    message: 'LOADING UPDATED MONGO SNAPSHOT',
  })

  // 6. Load all stored Double Up matches from DB and return
  const matchDocs = await findMatchesByPuuid(puuid, 0).catch(() => [])
  const matches = matchDocs
    .map(doc => normalizeMatch(doc, puuid, CURRENT_SET))
    .filter(Boolean)
    .sort((a, b) => b.date - a.date)

  const rankSnapshots = await findRankSnapshots(puuid, { sinceMs: SET_RELEASE_MS }).catch(() => [])

  return {
    summoner: { gameName: resolvedGameName, tagLine: resolvedTagLine, puuid },
    matches,
    rankInfo,
    rankSnapshots,
    participantRanks: await buildParticipantRanks(matches, rankInfo, puuid),
    cache: {
      source: 'mongo',
      matchCount: matches.length,
      lastMatchAt: matches[0]?.date ?? null,
      lastUpdated: syncedAt,
    },
  }
}

export function ensurePlayerRefresh(gameName, tagLine, region, options = {}) {
  validateRiotId(gameName, tagLine)
  const { force = false } = options
  const key = syncKey(region, gameName, tagLine)
  const existing = syncJobs.get(key)
  const now = Date.now()

  if (existing?.state === 'syncing') return publicSyncStatus(existing)
  if (!force && existing && now - (existing.completedAt ?? existing.updatedAt ?? 0) < SYNC_RESTART_DELAY) {
    return publicSyncStatus(existing)
  }

  const job = {
    state: 'syncing',
    phase: 'queued',
    message: 'QUEUED FOR RIOT REFRESH',
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    totalNewMatches: null,
    processedNewMatches: 0,
    matchIdsFound: null,
  }
  syncJobs.set(key, job)

  getPlayerMatches(gameName, tagLine, region, null, job)
    .then(() => {
      touchSync(job, {
        state: 'complete',
        phase: 'complete',
        message: 'MATCH HISTORY IS CURRENT',
        etaSeconds: 0,
        completedAt: Date.now(),
      })
    })
    .catch(err => {
      touchSync(job, {
        state: 'error',
        phase: 'error',
        message: 'MATCH HISTORY REFRESH FAILED',
        error: err?.response?.status === 404 ? 'RIOT ID NOT FOUND' : (err?.message || 'FAILED TO REFRESH MATCH DATA'),
        completedAt: Date.now(),
      })
    })

  setTimeout(() => {
    const current = syncJobs.get(key)
    if (current && current !== job) return
    if (Date.now() - (job.completedAt ?? job.updatedAt ?? job.startedAt) >= SYNC_STATUS_TTL) {
      syncJobs.delete(key)
    }
  }, SYNC_STATUS_TTL + SYNC_RESTART_DELAY)

  return publicSyncStatus(job)
}
