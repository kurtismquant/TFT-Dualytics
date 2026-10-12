import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeControls from './BronzeControls.jsx'
import BronzeCompRow from './BronzeCompRow.jsx'
import LoadMore from './LoadMore.jsx'
import ItemIcon from '../ItemIcon.jsx'
import UnitIcon from '../UnitIcon.jsx'
import { useBronzeSearch } from '../../hooks/useBronzeSearch.js'
import { useChampions } from '../../hooks/useChampions.js'
import { useItems } from '../../hooks/useItems.js'
import { useTraits } from '../../hooks/useTraits.js'
import { toBuilderRoster } from '../../utils/builderRoster.js'
import { buildEmblemOptions, LEGENDARY_COST, TRAIT_CHOICE_UNIT_IDS, traitRanges } from '../../utils/bronzeComps.js'
import { makeMap } from '../../utils/statsFormatting.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './BronzeComps.module.css'

// The search returns up to MAX_RESULTS comps; the list shows PAGE_SIZE more
// each time the user scrolls to its end.
const MAX_RESULTS = 100
const PAGE_SIZE = 20
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

  // Pages shown, reset whenever a new result arrives.
  const [paging, setPaging] = useState({ result: null, shown: PAGE_SIZE })
  const shown = paging.result === result ? paging.shown : PAGE_SIZE
  const total = result?.comps.length || 0
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
        <>
          <ol
            className={`${styles.list} ${isSearching ? styles.updating : ''}`}
            aria-busy={isSearching}
            aria-label={t('bronze.resultsLabel', { count: filters.size })}
          >
            {result.comps.slice(0, shown).map((comp, index) => (
              <BronzeCompRow
                key={comp.key}
                comp={comp}
                rank={index + 1}
                traitByName={traitByName}
                traits={traits}
                champions={champions}
                championsById={championsById}
                emblemByTrait={emblemByTrait}
              />
            ))}
          </ol>
          {shown < total && <LoadMore onMore={showMore} shown={shown} />}
        </>
      )}
    </section>
  )
}
