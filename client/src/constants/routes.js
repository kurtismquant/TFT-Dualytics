export const ROUTES = {
  home: '/',
  comps: '/comps',
  stats: '/stats',
  statsTab: '/stats/:tab',
  unit: '/units/:unitId',
  unitView: '/units/:unitId/:view',
  item: '/items/:itemId',
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

// Items are keyed by Riot apiName (what match data stores), e.g. TFT_Item_InfinityEdge.
export function buildItemPath(itemId, patch = null) {
  const path = `/items/${encodeURIComponent(itemId)}`
  return patch ? `${path}?patch=${encodeURIComponent(patch)}` : path
}

// Tabs of the unit stats page, in nav order; the first is the default view.
export const UNIT_VIEWS = ['comps', 'items', 'combos']

export function buildUnitViewPath(unitId, view, search = '') {
  const path = `/units/${encodeURIComponent(unitId)}`
  return `${view === UNIT_VIEWS[0] ? path : `${path}/${view}`}${search}`
}

// Stats sections, in nav order; the first is where /stats lands.
export const STATS_TABS = ['units', 'traits', 'items', 'explorer']

export function buildStatsPath(tab, search = '') {
  return `/stats/${tab}${search}`
}
