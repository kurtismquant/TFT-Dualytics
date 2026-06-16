import { getLeaderboard } from '../db/leaderboardRepo.js'
import { getPlayerMatches } from './summonerMatches.js'
import { runCompAggregation } from './compsAggregator.js'
import { getPlatformRegion } from './riotApi.js'

// Sync match history for the top N leaderboard players, then re-aggregate comps.
// Runs as a background cron job — keeps comp data fresh without user interaction.
const SYNC_TOP_N = 50

let running = false

export async function runLeaderboardMatchSync(regionInput = process.env.REGION || 'na1') {
  if (running) {
    console.log('[leaderboardSync] already running, skipping')
    return
  }
  running = true
  const platform = getPlatformRegion(regionInput)

  try {
    const leaderboard = await getLeaderboard(platform)
    if (!leaderboard?.entries?.length) {
      console.log('[leaderboardSync] no leaderboard data — skipping match sync')
      return
    }

    const players = leaderboard.entries
      .filter(e => e.gameName && e.tagLine)
      .slice(0, SYNC_TOP_N)

    console.log(`[leaderboardSync] syncing ${players.length} players for ${platform}`)
    let synced = 0

    for (const player of players) {
      if (running === false) break // allow external cancellation
      try {
        // priority 0: background sync — queued user lookups always preempt it,
        // and getPlayerMatches keeps it on the sequential (non-flooding) path.
        await getPlayerMatches(player.gameName, player.tagLine, platform, null, null, { priority: 0 })
        synced++
      } catch (err) {
        console.error(`[leaderboardSync] ${player.gameName}#${player.tagLine} failed:`, err.message)
      }
    }

    console.log(`[leaderboardSync] synced ${synced}/${players.length} players — running comp aggregation`)
    await runCompAggregation()
    console.log('[leaderboardSync] done')
  } finally {
    running = false
  }
}
