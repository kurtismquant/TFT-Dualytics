import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'
import { STATIC_ASSET_STALE_MS } from '../constants/cache.js'

export const useItems = () =>
  useQuery({
    queryKey: ['items'],
    queryFn: () => apiGet('/api/assets/items'),
    staleTime: STATIC_ASSET_STALE_MS,
  })
