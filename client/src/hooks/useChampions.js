import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'
import { STATIC_ASSET_STALE_MS } from '../constants/cache.js'

export const useChampions = () =>
  useQuery({
    queryKey: ['champions'],
    queryFn: () => apiGet('/api/assets/champions'),
    staleTime: STATIC_ASSET_STALE_MS,
  })
