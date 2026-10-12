import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiPost } from '../api/client.js'

// How many boards this patch fielded exactly each comp's units (stars and
// items ignored), from the server's board index: one POST for the whole list.
// Answers 503 until the index is built after startup; the hook then just has
// no data (no stars) rather than retrying in a loop.
export function usePlayedBoards(comps) {
  const boards = useMemo(
    () => (comps || []).map(comp => [...new Set(comp.units.map(unit => unit.champion.id))]),
    [comps],
  )
  const key = useMemo(() => boards.map(units => [...units].sort().join('|')), [boards])
  return useQuery({
    queryKey: ['playedBoards', key],
    queryFn: () => apiPost('/api/stats/explorer/played', { boards }),
    enabled: boards.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
