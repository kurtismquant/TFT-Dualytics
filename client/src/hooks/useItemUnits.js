import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

// Every unit that held one item on enough boards on the patch, with how it placed.
export const useItemUnits = ({ itemId, patch }) =>
  useQuery({
    queryKey: ['itemUnits', itemId, patch ?? null],
    queryFn: async () => {
      const params = patch ? { patch } : undefined
      return apiGet(`/api/stats/items/${encodeURIComponent(itemId)}/units`, { params })
    },
    enabled: Boolean(itemId),
    staleTime: 5 * 60 * 1000,
    // No lastUpdated = the server hasn't stored this item's table yet (the first
    // background pass after a deploy, or the item hasn't been built). Check back
    // every minute rather than sitting on the empty answer for ten.
    refetchInterval: query => (query.state.data && !query.state.data.lastUpdated ? 60 * 1000 : 10 * 60 * 1000),
  })
