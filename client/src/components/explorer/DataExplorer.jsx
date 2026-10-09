import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ExplorerFilters from './ExplorerFilters.jsx'
import ExplorerSummary from './ExplorerSummary.jsx'
import ExplorerBreakdown from './ExplorerBreakdown.jsx'
import { useBoardExplorer } from '../../hooks/useBoardExplorer.js'
import { useChampions } from '../../hooks/useChampions.js'
import { useItems } from '../../hooks/useItems.js'
import { useTraits } from '../../hooks/useTraits.js'
import { makeMap } from '../../utils/statsFormatting.js'
import { filtersToSearch, MAX_EXPLORER_FILTERS, parseExplorerParams } from '../../utils/explorerParams.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './DataExplorer.module.css'

// Board explorer: pick units (star range, held items), traits (tier) and items;
// see how boards with all of them place and what else they run. Filters live
// in the URL (?u=&t=&i=) so explorations can be shared.
export default function DataExplorer() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseExplorerParams(searchParams), [searchParams])
  const setFilters = useCallback(
    next => setSearchParams(filtersToSearch(next), { replace: true }),
    [setSearchParams]
  )

  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data: traits } = useTraits()
  const lookups = useMemo(() => ({
    unit: makeMap(champions),
    item: makeMap(items),
    trait: makeMap(traits),
  }), [champions, items, traits])
  const { data, isLoading, isError, isFetching } = useBoardExplorer(filters)

  // Adds a filter of the given kind (from search or a breakdown row).
  const addFilter = useCallback((kind, id, extra = {}) => {
    const key = `${kind}s`
    const current = filters[key]
    if (current.length >= MAX_EXPLORER_FILTERS) return
    if (current.some(entry => (kind === 'item' ? entry : entry.id) === id)) return
    const entry = kind === 'item' ? id : kind === 'unit' ? { id, items: [], ...extra } : { id, ...extra }
    setFilters({ ...filters, [key]: [...current, entry] })
  }, [filters, setFilters])

  return (
    <section className={styles.explorer} aria-label={t('explorer.label')}>
      <p className={styles.intro}>{t('explorer.intro')}</p>
      <ExplorerFilters
        filters={filters}
        setFilters={setFilters}
        addFilter={addFilter}
        lookups={lookups}
        champions={champions}
        items={items}
        traits={traits}
      />
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('explorer.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('explorer.error')}</p>}
      {data?.ready === false && <p className={statsStyles.message} role="status">{t('explorer.notReady')}</p>}
      {data?.ready && (
        <div className={isFetching ? styles.updating : undefined} aria-busy={isFetching}>
          <ExplorerSummary data={data} filters={filters} />
          <ExplorerBreakdown data={data} lookups={lookups} onAdd={addFilter} />
        </div>
      )}
    </section>
  )
}
