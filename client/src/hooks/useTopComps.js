import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

export const useTopComps = (options = {}) =>
  useQuery({
    queryKey: ['topComps', options?.limit ?? null, options?.patch ?? null],
    queryFn: () => {
      const params = {}
      if (options?.limit != null) params.limit = options.limit
      if (options?.patch) params.patch = options.patch
      return apiGet('/api/comps', { params: Object.keys(params).length ? params : undefined })
    },
    staleTime: 0,
    refetchInterval: 10 * 60 * 1000,
  })
