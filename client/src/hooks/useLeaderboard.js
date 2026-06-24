import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'

export const useLeaderboard = (region) =>
  useQuery({
    queryKey: ['leaderboard', region],
    queryFn: () => apiGet('/api/leaderboard', { params: { region } }),
    enabled: !!region,
    staleTime: 60 * 60 * 1000,
    refetchInterval: (query) => {
      // Poll only while a refresh is actually running. Polling on empty too made an
      // empty/failed ladder refetch every 5s forever, re-triggering failing aggregations;
      // when not refreshing we just show the last-good ladder (or the page's noData state).
      const pending = query.state.data?.refreshing
      return pending ? 5_000 : false
    },
    refetchIntervalInBackground: true,
  })
