import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

export const useStats = ({ type, patch, enabled = true }) =>
  useQuery({
    enabled,
    queryKey: ['stats', type, patch ?? null],
    queryFn: async () => {
      const params = { type }
      if (patch) params.patch = patch
      return apiGet('/api/stats', { params })
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
