import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client.js'
import { useBoardStore } from '../store/boardStore.js'
import { arrangeBoard, parseCellId, pickCell, unitRole } from '../utils/autoArrange.js'

const NOT_READY_RETRY_MS = 15 * 1000

// Per-unit item roles on the current patch (tank / AD / AP item shares).
// Like the other explorer hooks, a 503 { ready: false } is a result here.
const useUnitRoles = () =>
  useQuery({
    queryKey: ['unitRoles'],
    queryFn: () => apiGet('/api/stats/explorer/unit-roles', {
      validateStatus: status => (status >= 200 && status < 300) || status === 503,
    }),
    staleTime: 10 * 60 * 1000,
    refetchInterval: query => (query.state.data?.ready === false ? NOT_READY_RETRY_MS : false),
  })

// Team Builder placement by role (utils/autoArrange.js):
//  - placeUnit(championId): puts a clicked roster unit in the best free hex,
//    leaving the board's units where they are. Returns its cellId (null when full).
//  - autoArrange(): lays the whole board out again. Returns Map oldCellId -> newCellId.
// Without role stats (server warming up) melee units count as tanks.
export function useUnitPlacement(champions) {
  const { data } = useUnitRoles()
  const byId = useMemo(() => new Map((champions || []).map(c => [c.id, c])), [champions])
  const statsById = useMemo(() => new Map((data?.units || []).map(row => [row.id, row])), [data])

  const describe = useCallback((key, championId) => {
    const champion = byId.get(championId)
    // Stats are stored under the base unit (Lux forms -> base Lux).
    const stats = statsById.get(champion?.formOf ?? championId)
    return { key, cost: champion?.cost ?? 1, carry: stats?.itemsPerBoard ?? 0, ...unitRole(champion, stats) }
  }, [byId, statsById])

  const placedUnits = useCallback(board => Object.entries(board)
    .filter(([, cell]) => cell?.championId)
    .map(([cellId, cell]) => ({ ...describe(cellId, cell.championId), ...parseCellId(cellId) })), [describe])

  const placeUnit = useCallback((championId) => {
    const { board, placeUnit: place } = useBoardStore.getState()
    const cellId = pickCell(placedUnits(board), describe('new', championId))
    if (cellId) place(cellId, championId)
    return cellId
  }, [describe, placedUnits])

  const autoArrange = useCallback(() => {
    const { board, moveUnits } = useBoardStore.getState()
    const moves = arrangeBoard(placedUnits(board))
    moveUnits(moves)
    return moves
  }, [placedUnits])

  return { placeUnit, autoArrange }
}
