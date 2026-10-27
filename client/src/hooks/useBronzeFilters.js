import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { bronzeFiltersToSearch, parseBronzeParams } from '../utils/bronzeParams.js'

// Bronze for Life filters, kept in the URL (utils/bronzeParams.js) so a search
// can be bookmarked or shared. Updates replace the history entry.
export function useBronzeFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseBronzeParams(searchParams), [searchParams])
  const setFilter = useCallback((key, value) => setSearchParams(
    previous => bronzeFiltersToSearch({ ...parseBronzeParams(previous), [key]: value }),
    { replace: true },
  ), [setSearchParams])
  const resetFilters = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams])
  return { filters, setFilter, resetFilters }
}
