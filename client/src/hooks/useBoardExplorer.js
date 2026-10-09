import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'
import { serializeFilters } from '../utils/explorerParams.js'

const NOT_READY_RETRY_MS = 15 * 1000

// Board explorer results for the current patch. The server answers 503 with
// { ready: false } until its first aggregation pass has built the board index;
// that body is a result here (shown as "warming up"), polled until ready.
export const useBoardExplorer = filters => {
  const params = serializeFilters(filters)
  return useQuery({
    queryKey: ['boardExplorer', params.units ?? '', params.traits ?? '', params.items ?? ''],
    queryFn: () => apiGet('/api/stats/explorer', {
      params,
      validateStatus: status => (status >= 200 && status < 300) || status === 503,
    }),
    staleTime: 60 * 1000,
    // Keep the previous result on screen while the next filter set loads.
    placeholderData: previous => previous,
    refetchInterval: query => (query.state.data?.ready === false ? NOT_READY_RETRY_MS : false),
  })
}
