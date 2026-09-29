export const ROUTES = {
  home: '/',
  comps: '/comps',
  stats: '/stats',
  unit: '/units/:unitId',
  builder: '/builder',
  leaderboard: '/leaderboard',
  termsOfService: '/terms-of-service',
  privacyPolicy: '/privacy-policy',
  summoner: '/summoner/:region/:gameName/:tagLine',
  summonerCompare: '/summoner/:region/:gameName/:tagLine/:gameName2/:tagLine2',
}

export function buildSummonerPath(region, id) {
  return `/summoner/${region}/${encodeURIComponent(id.gameName)}/${encodeURIComponent(id.tagLine)}`
}

// `patch` is only added when a specific (e.g. older) patch was chosen, so the
// default link always follows the current patch.
export function buildUnitPath(unitId, patch = null) {
  const path = `/units/${encodeURIComponent(unitId)}`
  return patch ? `${path}?patch=${encodeURIComponent(patch)}` : path
}
