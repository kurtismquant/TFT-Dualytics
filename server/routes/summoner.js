import { Router } from 'express'
import { ensurePlayerRefresh, getStoredPlayerMatches } from '../services/summonerMatches.js'
import { findPlayersByGameName } from '../db/playerRepo.js'

const router = Router()

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || err instanceof DOMException
}

function handleError(err, res) {
  console.error('[summoner route] error:', err?.response?.status, err?.statusCode, err?.message)
  const status = err.response?.status
  if (status === 404) return res.status(404).json({ error: 'Riot ID not found' })
  if (status === 400) return res.status(400).json({ error: 'Invalid Riot ID' })
  if (status === 403 || err.statusCode === 403) return res.status(403).json({ error: err.message || 'Riot API key expired — regenerate your personal key' })
  if (err.statusCode === 400) return res.status(400).json({ error: err.message })
  res.status(500).json({ error: 'Failed to fetch summoner data' })
}

function serializePlayer(player) {
  return {
    puuid: player.puuid,
    gameName: player.accountDetails?.gameName || player.gameNameLower,
    tagLine: player.accountDetails?.tagLine || player.tagLineLower,
    tier: player.tier || null,
    rank: player.rank || null,
    leaguePoints: player.leaguePoints ?? null,
  }
}

function emptyStoredPlayer(gameName, tagLine) {
  return {
    summoner: { gameName, tagLine, puuid: null },
    matches: [],
    rankInfo: null,
    cache: {
      source: 'empty',
      matchCount: 0,
      lastMatchAt: null,
      lastUpdated: null,
    },
  }
}

// `since` (ms, optional): incremental poll cursor — only matches newer than it are
// loaded/returned. Null means a full load. Two-player route omits it (always full).
export function parseSince(raw) {
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

async function getCachedPayload(region, gameName, tagLine, since = null) {
  const stored = await getStoredPlayerMatches(gameName, tagLine, region, { since })
  const sync = ensurePlayerRefresh(gameName, tagLine, region)
  return {
    ...(stored ?? emptyStoredPlayer(gameName, tagLine)),
    sync,
  }
}

router.get('/resolve/:region/:gameName', async (req, res) => {
  const gameName = req.params.gameName?.trim()
  if (!gameName || gameName.length < 3 || gameName.length > 16 || gameName.includes('#') || gameName.includes('/')) {
    return res.status(400).json({ error: 'Invalid game name' })
  }

  try {
    const players = await findPlayersByGameName(gameName.toLowerCase())
    res.json({ players: players.map(serializePlayer) })
  } catch (err) {
    console.error('[summoner resolve route] error:', err?.message)
    res.json({ players: [] })
  }
})

router.get('/:region/:gameName/:tagLine', async (req, res) => {
  const { region, gameName, tagLine } = req.params
  try {
    const result = await getCachedPayload(region, gameName, tagLine, parseSince(req.query.since))
    res.json(result)
  } catch (err) {
    if (isAbortError(err)) return res.status(499).end()
    handleError(err, res)
  }
})

router.post('/:region/:gameName/:tagLine/refresh', async (req, res) => {
  const { region, gameName, tagLine } = req.params
  try {
    const sync = ensurePlayerRefresh(gameName, tagLine, region, { force: true })
    res.json({ sync })
  } catch (err) {
    if (isAbortError(err)) return res.status(499).end()
    handleError(err, res)
  }
})

router.get('/:region/:gameName/:tagLine/:gameName2/:tagLine2', async (req, res) => {
  const { region, gameName, tagLine, gameName2, tagLine2 } = req.params
  try {
    const [r1, r2] = await Promise.all([
      getCachedPayload(region, gameName, tagLine),
      getCachedPayload(region, gameName2, tagLine2),
    ])

    const ids2 = new Set(r2.matches.map(m => m.matchId))
    const ids1 = new Set(r1.matches.map(m => m.matchId))
    for (const m of r1.matches) {
      m.wasPartnerWith = m.partnerGroupId !== null && ids2.has(m.matchId)
    }
    for (const m of r2.matches) {
      m.wasPartnerWith = m.partnerGroupId !== null && ids1.has(m.matchId)
    }

    res.json({ summoner1: r1, summoner2: r2 })
  } catch (err) {
    if (isAbortError(err)) return res.status(499).end()
    handleError(err, res)
  }
})

export default router
