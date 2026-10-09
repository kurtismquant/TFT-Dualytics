import { useCallback, useMemo, useState } from 'react'
import {
  compareExplorerRows, DEFAULT_EXPLORER_SORT, nextExplorerSort,
} from '../utils/explorerSort.js'

// Column sort state for an explorer breakdown: rows sorted by the active
// column (most played first by default) and a click handler for a column key.
export function useExplorerSort(rows) {
  const [sort, setSort] = useState(DEFAULT_EXPLORER_SORT)
  const sorted = useMemo(() => rows.slice().sort((a, b) => compareExplorerRows(a, b, sort)), [rows, sort])
  const onSort = useCallback(key => setSort(current => nextExplorerSort(current, key)), [])
  return { sort, sorted, onSort }
}
