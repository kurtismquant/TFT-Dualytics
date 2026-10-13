import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

const NOT_READY_RETRY_MS = 15 * 1000
// A unit is "often played with" the board at this share of matching boards.
export const RECOMMEND_MIN_FREQUENCY = 0.5

// How often each unit is fielded on this patch's boards that run all of
// `unitIds` (Team Builder gold names). Like useBoardExplorer, a 503
// { ready: false } before the server's first aggregation pass is a result here.
export const useUnitPartners = unitIds => {
  const units = [...unitIds].sort().join(',')
  return useQuery({
    queryKey: ['unitPartners', units],
    queryFn: () => apiGet('/api/stats/explorer/partners', {
      params: { units },
      validateStatus: status => (status >= 200 && status < 300) || status === 503,
    }),
    enabled: units !== '',
    staleTime: 60 * 1000,
    // Keep the previous highlights while the next board loads.
    placeholderData: previous => previous,
    refetchInterval: query => (query.state.data?.ready === false ? NOT_READY_RETRY_MS : false),
  })
}

// Builder board + roster -> Set of roster ids to show in gold: units on at
// least RECOMMEND_MIN_FREQUENCY of the boards that run every placed unit.
// Board units are sent by base id (Lux forms -> base Lux, as the server's board
// index stores them); a base id in the answer lights up all of its forms.
export const useRecommendedUnits = (board, champions) => {
  const placedIds = useMemo(() => {
    const byId = new Map((champions || []).map(c => [c.id, c]))
    const ids = Object.values(board)
      .filter(cell => cell?.championId)
      .map(cell => byId.get(cell.championId)?.formOf ?? cell.championId)
    return [...new Set(ids)]
  }, [board, champions])
  const { data } = useUnitPartners(placedIds)

  return useMemo(() => {
    const recommended = new Set()
    if (!placedIds.length || !data?.ready) return recommended
    // Placed units are dropped here too: `data` may still be the previous board's.
    const often = new Set(data.units.filter(u => u.frequency >= RECOMMEND_MIN_FREQUENCY).map(u => u.id))
    for (const id of placedIds) often.delete(id)
    for (const champion of champions || []) {
      if (often.has(champion.formOf ?? champion.id)) recommended.add(champion.id)
    }
    return recommended
  }, [data, placedIds, champions])
}
