export const ROUTES = {
  home: '/',
  comps: '/comps',
  stats: '/stats',
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
