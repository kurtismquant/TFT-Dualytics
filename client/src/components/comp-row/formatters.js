export function placementBucket(avgPlacement) {
  return Math.max(1, Math.min(4, Math.round(avgPlacement)))
}

export function formatGames(playCount, t) {
  return t('comp.timesPlayed', { count: playCount })
}

export function formatPairings(pairCount, t) {
  return t('comp.timesPlayed', { count: pairCount })
}

export function formatWinRate(winRate) {
  return `${(winRate * 100).toFixed(1)}% win`
}

export function formatAveragePlacement(avgPlacement) {
  return `Avg ${avgPlacement.toFixed(2)}`
}
