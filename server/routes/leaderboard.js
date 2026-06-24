import { Router } from 'express'
import { getLeaderboard } from '../db/leaderboardRepo.js'
import { runLeaderboardAggregation, isRefreshing, isRetryCoolingDown } from '../services/leaderboardAggregator.js'
import { getPlatformRegion } from '../services/riotApi.js'

const router = Router()
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

router.get('/', async (req, res) => {
  const regionInput = req.query.region || 'na1'
  const platform = getPlatformRegion(regionInput)

  try {
    const cached = await getLeaderboard(platform)
    const age = cached?.updatedAt ? Date.now() - new Date(cached.updatedAt).getTime() : Infinity
    const empty = !cached?.entries || cached.entries.length === 0
    const stale = age > ONE_DAY_MS || empty

    // Don't relaunch a doomed refresh on every poll while a recent failure is cooling down;
    // a manual POST /refresh can still force one. The cooldown bounds a key-outage 401 storm.
    if (stale && !isRefreshing(platform) && !isRetryCoolingDown(platform)) {
      runLeaderboardAggregation(platform)
    }

    res.json({
      region: platform,
      updatedAt: empty ? null : cached?.updatedAt ?? null,
      refreshing: isRefreshing(platform),
      entries: cached?.entries ?? [],
    })
  } catch (err) {
    console.error('Leaderboard fetch failed:', err.message)
    res.status(500).json({
      region: platform,
      updatedAt: null,
      refreshing: false,
      entries: [],
      error: 'Failed to load leaderboard',
    })
  }
})

router.post('/refresh', async (req, res) => {
  const regionInput = req.query.region || 'na1'
  const platform = getPlatformRegion(regionInput)
  const already = isRefreshing(platform)
  if (!already) runLeaderboardAggregation(platform)
  res.json({ region: platform, triggered: !already, refreshing: true })
})

export default router
