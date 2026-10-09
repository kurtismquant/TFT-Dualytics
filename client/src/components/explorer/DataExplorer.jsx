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
import { EXPLORER_VIEWS, filtersToSearch, MAX_UNIT_ITEMS, parseExplorerParams } from '../../utils/explorerParams.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './DataExplorer.module.css'

const NO_UNITS = []

// Board explorer: pick units (star range, held items), traits (tier) and items;
// see how boards with all of them place and what else they run. Filters and
// the open view live in the URL (?u=&t=&i=&v=) so explorations can be shared.
export default function DataExplorer() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseExplorerParams(searchParams), [searchParams])
  const view = EXPLORER_VIEWS.includes(searchParams.get('v')) ? searchParams.get('v') : EXPLORER_VIEWS[0]
  const setFilters = useCallback(next => setSearchParams(previous => {
    const params = filtersToSearch(next)
    if (previous.get('v')) params.set('v', previous.get('v'))
    return params
  }, { replace: true }), [setSearchParams])
  const setView = useCallback(next => setSearchParams(previous => {
    const params = new URLSearchParams(previous)
    if (next === EXPLORER_VIEWS[0]) params.delete('v')
    else params.set('v', next)
    return params
  }, { replace: true }), [setSearchParams])

  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data: traits } = useTraits()
  const lookups = useMemo(() => ({
    unit: makeMap(champions),
    item: makeMap(items),
    trait: makeMap(traits),
  }), [champions, items, traits])
  const { data, isLoading, isError, isFetching } = useBoardExplorer(filters)
  const filteredUnitIds = useMemo(() => filters.units.map(unit => unit.id), [filters.units])

  // Adds a filter of the given kind (from search or a breakdown row).
  const addFilter = useCallback((kind, id, extra = {}) => {
    const key = `${kind}s`
    const current = filters[key]
    if (current.some(entry => (kind === 'item' ? entry : entry.id) === id)) return
    const entry = kind === 'item' ? id : kind === 'unit' ? { id, items: [], ...extra } : { id, ...extra }
    setFilters({ ...filters, [key]: [...current, entry] })
  }, [filters, setFilters])

  // From a unit's item row: require the item on that unit (adding the unit if needed).
  const addUnitItem = useCallback((unitId, itemId) => {
    const index = filters.units.findIndex(entry => entry.id === unitId)
    if (index === -1) {
      addFilter('unit', unitId, { items: [itemId] })
      return
    }
    const entry = filters.units[index]
    if (entry.items.includes(itemId) || entry.items.length >= MAX_UNIT_ITEMS) return
    const units = filters.units.slice()
    units[index] = { ...entry, items: [...entry.items, itemId] }
    setFilters({ ...filters, units })
  }, [addFilter, filters, setFilters])

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
        recommended={(data?.ready && data.units) || NO_UNITS}
      />
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('explorer.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('explorer.error')}</p>}
      {data?.ready === false && <p className={statsStyles.message} role="status">{t('explorer.notReady')}</p>}
      {data?.ready && (
        <div className={isFetching ? styles.updating : undefined} aria-busy={isFetching}>
          <ExplorerSummary data={data} filters={filters} />
          <ExplorerBreakdown
            view={view}
            setView={setView}
            data={data}
            lookups={lookups}
            champions={champions}
            items={items}
            traits={traits}
            filteredUnitIds={filteredUnitIds}
            onAdd={addFilter}
            onAddUnitItem={addUnitItem}
          />
        </div>
      )}
    </section>
  )
}
