import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeControls from './BronzeControls.jsx'
import BronzeCompRow from './BronzeCompRow.jsx'
import LoadMore from './LoadMore.jsx'
import RecommendedUnits from './RecommendedUnits.jsx'
import ItemIcon from '../ItemIcon.jsx'
import UnitIcon from '../UnitIcon.jsx'
import { useBronzeSearch } from '../../hooks/useBronzeSearch.js'
import { usePlayedBoards } from '../../hooks/usePlayedBoards.js'
import { useChampions } from '../../hooks/useChampions.js'
import { useItems } from '../../hooks/useItems.js'
import { useTraits } from '../../hooks/useTraits.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { useUiScale } from '../../contexts/useUiScale.js'
import { toBuilderRoster } from '../../utils/builderRoster.js'
import {
  buildEmblemOptions, groupByTraitCount, HIGHLY_PLAYED_MIN_BOARDS, LEGENDARY_COST, recommendUnits, TRAIT_CHOICE_UNIT_IDS, traitRanges,
} from '../../utils/bronzeComps.js'
import { makeMap } from '../../utils/statsFormatting.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './BronzeComps.module.css'

// The search returns up to MAX_RESULTS comps; the list shows PAGE_SIZE more
// each time the user scrolls to its end.
const MAX_RESULTS = 100
const PAGE_SIZE = 20
// The recommended-units widget counts units across this many top comps.
const RECOMMEND_POOL = 20
// Window width (rem) from which the widget fits in the left margin outside
// the content box: the 77.5rem box plus two margins each holding the 9.5rem
// widget, its 1.25rem gap and 0.75rem of room, less the 2rem page gutter,
// plus ~1rem for a scrollbar. Media queries ignore the root font-size, so
// it's converted with the Interface Size factor (16px per rem at Compact).
const SIDE_WIDGET_MIN_REM = 97.5
const DEFAULT_FILTERS = {
  size: 8, includeSilverGold: false, excludeLegendary: false, excludeKhaZix: false, requiredIds: [], emblemIds: [],
}

// Bronze for Life: comps of N units with the most traits in their bronze tier
// (optionally silver/gold too). Computed in the browser from the static asset
// lists by utils/bronzeComps.js, in a Web Worker (up to ~0.5s on Set 18).
export default function BronzeComps() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const setFilter = useCallback((key, value) => setFilters(current => ({ ...current, [key]: value })), [])

  const champs = useChampions()
  const traitsQuery = useTraits()
  const itemsQuery = useItems()
  const champions = champs.data
  const traits = traitsQuery.data
  const items = itemsQuery.data

  // Same roster as the builder: base Lux dropped, forms count double.
  const fullRoster = useMemo(() => toBuilderRoster(champions || []), [champions])
  const roster = useMemo(() => fullRoster.filter(unit => (
    !(filters.excludeLegendary && (unit.cost || 0) >= LEGENDARY_COST)
    && !(filters.excludeKhaZix && TRAIT_CHOICE_UNIT_IDS.has(unit.id))
  )), [filters.excludeLegendary, filters.excludeKhaZix, fullRoster])
  const ranges = useMemo(() => traitRanges(traits, { includeSilverGold: filters.includeSilverGold }), [traits, filters.includeSilverGold])
  // Emblem choices don't change with the silver/gold option.
  const emblemOptions = useMemo(() => buildEmblemOptions(items, traitRanges(traits, { includeSilverGold: true })), [items, traits])
  const itemLookup = useMemo(() => makeMap(items), [items])
  const unitLookup = useMemo(() => makeMap(fullRoster), [fullRoster])
  const traitByName = useMemo(() => new Map((traits || []).map(trait => [trait.name, trait])), [traits])
  const emblemByTrait = useMemo(() => new Map(emblemOptions.map(option => [option.trait, itemLookup.get(option.id)])), [emblemOptions, itemLookup])

  const unitPicker = useMemo(() => ({
    options: [...roster].sort((a, b) => a.name.localeCompare(b.name)).map(unit => ({ id: unit.id, name: unit.name })),
    renderIcon: (id, size) => <UnitIcon champion={unitLookup.get(id)} size={size} />,
    nameFor: id => unitLookup.get(id)?.name || id,
  }), [roster, unitLookup])
  const emblemPicker = useMemo(() => ({
    options: emblemOptions,
    renderIcon: (id, size) => <ItemIcon item={itemLookup.get(id)} size={size} />,
    nameFor: id => itemLookup.get(id)?.name || id,
  }), [emblemOptions, itemLookup])

  // Required units the roster no longer has (5-costs, Kha'Zix after excluding them) drop out.
  const requiredIds = useMemo(
    () => filters.requiredIds.filter(id => roster.some(unit => unit.id === id)),
    [filters.requiredIds, roster],
  )
  const emblemTraits = useMemo(() => {
    const traitById = new Map(emblemOptions.map(option => [option.id, option.trait]))
    return filters.emblemIds.map(id => traitById.get(id)).filter(Boolean)
  }, [filters.emblemIds, emblemOptions])

  const search = useMemo(
    () => (roster.length > 0 && ranges.size > 0
      ? { roster, ranges, size: filters.size, emblemTraits, requiredIds, limit: MAX_RESULTS }
      : null),
    [roster, ranges, filters.size, emblemTraits, requiredIds],
  )
  const { result, error: searchError, isSearching } = useBronzeSearch(search)
  const championsById = useMemo(() => makeMap(champions), [champions])
  const uiScale = useUiScale()
  const widgetOutside = useMediaQuery(`(min-width: ${Math.round(SIDE_WIDGET_MIN_REM * 16 * uiScale)}px)`)

  // Pages shown, reset whenever a new result arrives.
  const [paging, setPaging] = useState({ result: null, shown: PAGE_SIZE })
  const shown = paging.result === result ? paging.shown : PAGE_SIZE
  const total = result?.comps.length || 0
  // comp key -> { count, avgPlacement } for comps played often enough to star.
  const played = usePlayedBoards(result?.comps)
  const highlyPlayed = useMemo(() => {
    const map = new Map()
    const rows = played.data?.results || []
    result?.comps.forEach((comp, i) => {
      if ((rows[i]?.count || 0) >= HIGHLY_PLAYED_MIN_BOARDS) map.set(comp.key, rows[i])
    })
    return map
  }, [played.data, result])
  // Starred comps lead their trait count, ahead of the cost order (before
  // paging, so a starred comp deep in the list still shows near the top).
  const ordered = useMemo(() => (result?.comps || [])
    .map((comp, index) => ({ comp, index }))
    .sort((a, b) => b.comp.traitCount - a.comp.traitCount
      || Number(highlyPlayed.has(b.comp.key)) - Number(highlyPlayed.has(a.comp.key))
      || a.index - b.index)
    .map(entry => entry.comp), [result, highlyPlayed])
  const groups = useMemo(() => groupByTraitCount(ordered.slice(0, shown)), [ordered, shown])
  const recommended = useMemo(() => recommendUnits(ordered, { top: RECOMMEND_POOL }), [ordered])
  const showMore = useCallback(() => setPaging(current => {
    const base = current.result === result ? current.shown : PAGE_SIZE
    return base >= total ? current : { result, shown: Math.min(base + PAGE_SIZE, total) }
  }), [result, total])

  const isLoading = champs.isLoading || traitsQuery.isLoading || itemsQuery.isLoading
  const isError = champs.isError || traitsQuery.isError || itemsQuery.isError || Boolean(searchError)
  const tooManyRequired = requiredIds.length > filters.size || result?.tooManyRequired

  return (
    <section className={styles.page} aria-label={t('bronze.label')}>
      <BronzeControls
        filters={{ ...filters, requiredIds }}
        setFilter={setFilter}
        emblemPicker={emblemPicker}
        unitPicker={unitPicker}
      />
      {(isLoading || (isSearching && !result)) && (
        <p className={statsStyles.message} role="status" aria-live="polite">{t(isLoading ? 'bronze.loading' : 'bronze.searching')}</p>
      )}
      {isError && <p className={statsStyles.message} role="alert">{t('bronze.error')}</p>}
      {tooManyRequired && <p className={statsStyles.message} role="status">{t('bronze.tooManyRequired')}</p>}
      {!isLoading && !isError && !isSearching && !tooManyRequired && result?.comps.length === 0 && (
        <p className={statsStyles.message} role="status">{t('bronze.empty')}</p>
      )}
      {result?.truncated && <p className={statsStyles.message} role="status">{t('bronze.truncated')}</p>}
      {total > 0 && (
        <div className={styles.resultsLayout} data-widget={widgetOutside ? 'outside' : 'inline'}>
          <div className={styles.resultsMain}>
            <div
              className={`${styles.list} ${isSearching ? styles.updating : ''}`}
              aria-busy={isSearching}
              aria-label={t('bronze.resultsLabel', { count: filters.size })}
              role="region"
            >
              <p className={styles.legend}>
                <span className={styles.legendStar} aria-hidden="true">★</span>
                {t('bronze.legendHighlyPlayed', { count: HIGHLY_PLAYED_MIN_BOARDS })}
              </p>
              {groups.map(group => (
                <section key={group.traitCount} className={styles.group}>
                  <h3 className={styles.groupHeading}>{t('bronze.groupHeading', { count: group.traitCount })}</h3>
                  <ol className={styles.groupList}>
                    {group.comps.map(comp => (
                      <BronzeCompRow
                        key={comp.key}
                        comp={comp}
                        traitByName={traitByName}
                        traits={traits}
                        champions={champions}
                        championsById={championsById}
                        emblemByTrait={emblemByTrait}
                        played={highlyPlayed.get(comp.key)}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            {shown < total && <LoadMore onMore={showMore} shown={shown} />}
          </div>
          <RecommendedUnits units={recommended} poolSize={Math.min(RECOMMEND_POOL, total)} />
        </div>
      )}
    </section>
  )
}
