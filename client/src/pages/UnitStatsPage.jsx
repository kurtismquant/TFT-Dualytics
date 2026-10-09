import { useCallback, useMemo, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageShell } from '../components/layout/PageShell.jsx'
import UnitHeader from '../components/unit-stats/UnitHeader.jsx'
import UnitOverview from '../components/unit-stats/UnitOverview.jsx'
import UnitStatsNav from '../components/unit-stats/UnitStatsNav.jsx'
import ItemFilterInput from '../components/unit-stats/ItemFilterInput.jsx'
import UnitCombosView from '../components/unit-stats/UnitCombosView.jsx'
import UnitItemsView from '../components/unit-stats/UnitItemsView.jsx'
import UnitCompsView from '../components/unit-stats/UnitCompsView.jsx'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useTraits } from '../hooks/useTraits.js'
import { useUnitItemCombos } from '../hooks/useUnitItemCombos.js'
import { UNIT_VIEWS } from '../constants/routes.js'
import {
  buildItemCandidates,
  buildItemLookup,
  comboMatchesFilters,
  DEFAULT_COMBO_SORT,
  nextComboSort,
  parseItemsParam,
  serializeItemsParam,
  sortCombos,
} from '../utils/itemComboFilter.js'
import {
  combosForStarRange,
  isFullItemRange,
  isFullStarRange,
  parseItemCountParam,
  parseStarsParam,
  serializeItemCountParam,
  serializeStarsParam,
} from '../utils/starRange.js'
import statsStyles from './StatsPage.module.css'
import styles from './UnitStatsPage.module.css'

const DEFAULT_MIN_GAMES = 10

// Per-unit stats: the unit's ability and base stats, then tabs for the comps it
// appears in, single items and 3-item combos (/units/:unitId/:view). Patch,
// star range, items-held range and item filters live in the URL
// (?patch=&stars=&itemCount=&items=) so views can be shared.
export default function UnitStatsPage() {
  const { t } = useTranslation()
  const { unitId, view: viewParam } = useParams()
  const view = UNIT_VIEWS.includes(viewParam) ? viewParam : UNIT_VIEWS[0]
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const patchParam = searchParams.get('patch')
  const itemsParam = searchParams.get('items')
  const filterIds = useMemo(() => parseItemsParam(itemsParam), [itemsParam])
  const starsParam = searchParams.get('stars')
  const starRange = useMemo(() => parseStarsParam(starsParam), [starsParam])
  const itemCountParam = searchParams.get('itemCount')
  const itemRange = useMemo(() => parseItemCountParam(itemCountParam), [itemCountParam])
  const [sort, setSort] = useState(DEFAULT_COMBO_SORT)

  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data: traits } = useTraits()
  const { data, isLoading, isError } = useUnitItemCombos({ unitId, patch: patchParam })

  const champion = useMemo(() => champions?.find(c => c.id === unitId) || null, [champions, unitId])
  const itemLookup = useMemo(() => buildItemLookup(items), [items])
  const minGames = data?.minGames ?? DEFAULT_MIN_GAMES
  const byStar = data?.byStar ?? null
  const byStarItems = data?.byStarItems ?? null
  // Every combo is a 3-item build, so an items-held range that stops below 3
  // excludes them all.
  const combosExcluded = Boolean(byStarItems) && itemRange.max < 3
  // Combos re-scored within the star range (10+ games inside it); item filters
  // and suggestions then apply on top of that.
  const combos = useMemo(
    () => (combosExcluded ? [] : combosForStarRange(data?.combos || [], byStar, starRange, minGames)),
    [combosExcluded, data?.combos, byStar, starRange, minGames]
  )
  const candidates = useMemo(
    () => buildItemCandidates(items, combos.flatMap(combo => combo.items)),
    [items, combos]
  )
  const rows = useMemo(
    () => sortCombos(combos.filter(combo => comboMatchesFilters(combo.items, filterIds)), sort),
    [combos, filterIds, sort]
  )

  // replace: filter/patch tweaks shouldn't each add a browser history entry.
  const setParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleFiltersChange = useCallback(ids => setParam('items', serializeItemsParam(ids)), [setParam])
  const handleStarRangeChange = useCallback(range => setParam('stars', serializeStarsParam(range)), [setParam])
  const handleItemRangeChange = useCallback(range => setParam('itemCount', serializeItemCountParam(range)), [setParam])
  const handleSort = useCallback(columnKey => setSort(current => nextComboSort(current, columnKey)), [])

  const unitName = champion?.name || unitId
  const patches = data?.patches || []
  const rangeLimited = (Boolean(byStar) && !isFullStarRange(starRange))
    || (Boolean(byStarItems) && !isFullItemRange(itemRange))

  return (
    <PageShell>
      <UnitHeader
        champion={champion}
        unitName={unitName}
        // Comps are aggregated boards with no star / items-held breakdown.
        showRangeFilters={view !== 'comps'}
        rangeFilters={{
          unit: { byStar, byStarItems },
          starRange,
          itemRange,
          onStarRangeChange: handleStarRangeChange,
          onItemRangeChange: handleItemRangeChange,
          fallback: { games: data?.games ?? 0, threeItemGames: data?.threeItemGames ?? 0 },
        }}
      />
      <UnitOverview champion={champion} traits={traits} />
      <UnitStatsNav unitId={unitId} view={view} search={location.search} />
      <div className={styles.controls}>
        <select
          className={statsStyles.select}
          value={data?.patch || patchParam || ''}
          onChange={event => { setParam('patch', event.target.value); event.target.blur() }}
          aria-label={t('stats.patchLabel')}
        >
          {patches.length === 0 && <option value="">{t('stats.noPatch')}</option>}
          {patches.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {view === 'combos' && (
          <ItemFilterInput
            filterIds={filterIds}
            candidates={candidates}
            itemLookup={itemLookup}
            onChange={handleFiltersChange}
          />
        )}
      </div>

      {view === 'comps' && (
        <UnitCompsView unitId={unitId} patch={patchParam} champions={champions} items={items} traits={traits} />
      )}
      {view === 'items' && (
        <UnitItemsView
          data={data}
          starRange={starRange}
          itemRange={itemRange}
          minGames={minGames}
          isLoading={isLoading}
          isError={isError}
          itemLookup={itemLookup}
          allItems={items}
          unitName={unitName}
          patch={patchParam}
        />
      )}
      {view === 'combos' && (
        <UnitCombosView
          rows={rows}
          minGames={minGames}
          isLoading={isLoading}
          isError={isError}
          filterCount={filterIds.length}
          combosExcluded={combosExcluded}
          rangeLimited={rangeLimited}
          sort={sort}
          onSort={handleSort}
          itemLookup={itemLookup}
          allItems={items}
          unitName={unitName}
        />
      )}
    </PageShell>
  )
}
