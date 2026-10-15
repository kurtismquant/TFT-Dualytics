import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBoardStore } from '../store/boardStore.js'
import { decodeBoardLink, encodeBoardLink } from '../utils/boardState.js'
import { ROUTES } from '../constants/routes.js'

const PARAM = 'b'

// A shared link (/builder?b=...) opens on its board, once the roster is in
// (one undo step back to the board you had). The parameter is then dropped
// from the address, so a reload keeps your edits rather than the link's board.
export function useSharedBoardLink(rosterReady) {
  const [params, setParams] = useSearchParams()
  const value = params.get(PARAM)
  useEffect(() => {
    if (!value || !rosterReady) return
    const board = decodeBoardLink(value)
    if (board) useBoardStore.getState().loadBoard(board)
    setParams(next => {
      next.delete(PARAM)
      return next
    }, { replace: true })
  }, [value, rosterReady, setParams])
}

// The link that opens this board, or null for an empty board.
export function boardLink(board) {
  const value = encodeBoardLink(board)
  return value ? `${window.location.origin}${ROUTES.builder}?${PARAM}=${value}` : null
}
