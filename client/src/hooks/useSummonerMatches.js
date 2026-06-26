import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../api/client.js'
import { mergeSummonerMatches, needsReconcile } from '../utils/mergeSummonerMatches.js'

function hasActiveSync(data) {
  if (!data) return false
  const statuses = data.summoner1 || data.summoner2
    ? [data.summoner1?.sync, data.summoner2?.sync]
    : [data.sync]
  return statuses.some(sync => sync?.state === 'syncing')
}

// ids: [{ gameName, tagLine }, ...] — 1 or 2 entries
function buildMatchesPath(ids) {
  return (ids || [])
    .flatMap(id => [encodeURIComponent(id.gameName.trim()), encodeURIComponent(id.tagLine.trim())])
    .join('/')
}

function buildMatchesKey(region, ids) {
  const key = (ids || []).flatMap(id => [id.gameName, id.tagLine])
  return ['summonerMatches', region, ...key]
}

export const useSummonerMatches = (region, ids) => {
  const queryClient = useQueryClient()
  const enabled = Array.isArray(ids) && ids.length > 0 &&
    ids.every(id => id?.gameName?.trim() && id?.tagLine?.trim())

  const path = buildMatchesPath(ids)
  const queryKey = buildMatchesKey(region, ids)
  // Only the single-player history goes incremental. The 2-player compare route
  // cross-references both full match lists server-side, so it always fetches full.
  const incremental = Array.isArray(ids) && ids.length === 1

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const base = `/api/summoner/${region}/${path}`
      const prev = incremental ? queryClient.getQueryData(queryKey) : undefined
      // Cursor = newest match we already hold (matches are sorted newest-first).
      // Omitted on first load / player switch (no prior data) → server sends full.
      const since = prev?.matches?.[0]?.date
      if (!incremental || since == null) return apiGet(base, { signal })

      const res = await apiGet(`${base}?since=${since}`, { signal })
      const merged = mergeSummonerMatches(prev, res)
      // Sync settled but our merged set drifted from the server's authoritative
      // total → one full reload reconciles (out-of-order backlog / TTL expiry).
      if (needsReconcile(merged)) return apiGet(base, { signal })
      return merged
    },
    enabled,
    retry: (failureCount, error) => error?.response?.status !== 404 && failureCount < 2,
    staleTime: 0,
    placeholderData: previousData => previousData,
    // 1s while a sync is running so new matches stream in as they land in Mongo.
    // 30s when idle: matches can arrive out-of-band (ingest daemon, hourly cron,
    // or the player's own just-finished game) and the page would otherwise never
    // learn about them — each idle tick re-reads Mongo and nudges the server's
    // auto-refresh, which ensurePlayerRefresh gates to at most once per 60s.
    // Intervals pause while the tab is hidden (refetchIntervalInBackground: false).
    refetchInterval: query => hasActiveSync(query.state.data) ? 1000 : 30_000,
  })
}

export const useRefreshSummonerMatches = (region, ids) => {
  const queryClient = useQueryClient()
  const queryKey = buildMatchesKey(region, ids)

  return useMutation({
    mutationFn: async (targetIds = ids) => {
      const requests = (targetIds || []).map(id =>
        apiPost(`/api/summoner/${region}/${buildMatchesPath([id])}/refresh`)
      )
      return Promise.all(requests)
    },
    onSuccess: () => queryClient.refetchQueries({ queryKey }),
  })
}
