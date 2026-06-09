import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../api/client.js'

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
  const enabled = Array.isArray(ids) && ids.length > 0 &&
    ids.every(id => id?.gameName?.trim() && id?.tagLine?.trim())

  const path = buildMatchesPath(ids)
  const queryKey = buildMatchesKey(region, ids)

  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet(`/api/summoner/${region}/${path}`, { signal }),
    enabled,
    retry: (failureCount, error) => error?.response?.status !== 404 && failureCount < 2,
    staleTime: 0,
    placeholderData: previousData => previousData,
    refetchInterval: query => hasActiveSync(query.state.data) ? 1000 : false,
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
