import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

// Every 3-item combo for one unit with enough games on the patch. Item filters
// are applied client-side, so they aren't part of the query key.
export const useUnitItemCombos = ({ unitId, patch }) =>
  useQuery({
    queryKey: ['unitItemCombos', unitId, patch ?? null],
    queryFn: async () => {
      const params = patch ? { patch } : undefined
      return apiGet(`/api/stats/units/${encodeURIComponent(unitId)}/combos`, { params })
    },
    enabled: Boolean(unitId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
