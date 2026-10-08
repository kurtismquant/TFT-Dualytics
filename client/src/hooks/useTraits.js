import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'
import { STATIC_ASSET_STALE_MS } from '../constants/cache.js'

export const useTraits = () =>
  useQuery({
    queryKey: ['traits'],
    queryFn: () => apiGet('/api/assets/traits'),
    staleTime: STATIC_ASSET_STALE_MS,
  })
