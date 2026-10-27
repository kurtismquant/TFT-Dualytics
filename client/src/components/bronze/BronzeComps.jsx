import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeFilters from './BronzeFilters.jsx'
import BronzeResults from './BronzeResults.jsx'
import ItemIcon from '../ItemIcon.jsx'
import UnitIcon from '../UnitIcon.jsx'
import { useBronzeSearch } from '../../hooks/useBronzeSearch.js'
import { useBronzeEmblems } from '../../hooks/useBronzeEmblems.js'
import { useBronzeFilters } from '../../hooks/useBronzeFilters.js'
import { useChampions } from '../../hooks/useChampions.js'
import { useItems } from '../../hooks/useItems.js'
import { useTraits } from '../../hooks/useTraits.js'
import { toBuilderRoster } from '../../utils/builderRoster.js'
import { BOARD_MAX_SWAPS, BOARD_WEIGHTS, traitChoiceOptions, TRAIT_CHOICE_UNIT_IDS, traitRanges } from '../../utils/bronzeComps.js'
import { countActiveFilters } from '../../utils/bronzeParams.js'
import { makeMap } from '../../utils/statsFormatting.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './BronzeComps.module.css'

// The search returns up to MAX_RESULTS comps (the list pages through them).
const MAX_RESULTS = 100
// Build-from-my-units scoring for the Tuning sliders (testing; not in the URL).
const DEFAULT_TUNING = { boardWeights: BOARD_WEIGHTS, maxSwaps: BOARD_MAX_SWAPS }

const unitOptions = units => [...units].sort((a, b) => a.name.localeCompare(b.name)).map(unit => ({ id: unit.id, name: unit.name }))

// Trait Comps: comps of N units with the most counted traits, for two
// playstyles: Bronze for Life (bronze tiers only) or Trait Ladder (any tier). Computed in the browser from the static asset
// lists by utils/bronzeComps.js, in a Web Worker. Filters live in the URL.
export default function BronzeComps() {
  const { t } = useTranslation()
  const { filters, setFilter, resetFilters } = useBronzeFilters()
  const [tuning, setTuning] = useState(DEFAULT_TUNING)

  const champs = useChampions()
  const traitsQuery = useTraits()
  const itemsQuery = useItems()
  const champions = champs.data
  const traits = traitsQuery.data
  const items = itemsQuery.data

  // Same roster as the builder: base Lux dropped, forms count double.
  const roster = useMemo(() => toBuilderRoster(champions || []), [champions])
  const choiceUnits = useMemo(() => roster.filter(unit => TRAIT_CHOICE_UNIT_IDS.has(unit.id)), [roster])
  // Their evolution traits (Kha'Zix's 4), each switchable in the sidebar.
  const choiceOptions = useMemo(() => [...new Set(choiceUnits.flatMap(unit => traitChoiceOptions(unit.id)))], [choiceUnits])
  const choiceTraits = useMemo(
    () => choiceOptions.filter(trait => !filters.choiceTraitsOff.includes(trait)),
    [choiceOptions, filters.choiceTraitsOff],
  )
  const ranges = useMemo(() => traitRanges(traits, { ladder: filters.traitLadder }), [traits, filters.traitLadder])
  const { emblemOptions, itemLookup, emblemByTrait, toolItems, craftTools, emblemTraits } = useBronzeEmblems({
    items, traits, emblemIds: filters.emblemIds, hasSpatula: filters.hasSpatula, hasFryingPan: filters.hasFryingPan,
  })
  const unitLookup = useMemo(() => makeMap(roster), [roster])
  const traitByName = useMemo(() => new Map((traits || []).map(trait => [trait.name, trait])), [traits])

  const pickers = useMemo(() => {
    const unitIcon = (id, size) => <UnitIcon champion={unitLookup.get(id)} size={size} />
    const unitName = id => unitLookup.get(id)?.name || id
    return {
      unit: { options: unitOptions(roster), renderIcon: unitIcon, nameFor: unitName },
      emblem: {
        options: emblemOptions,
        renderIcon: (id, size) => <ItemIcon item={itemLookup.get(id)} size={size} />,
        nameFor: id => itemLookup.get(id)?.name || id,
      },
    }
  }, [roster, unitLookup, emblemOptions, itemLookup])

  // Unit ids the roster doesn't have (e.g. from an old link) drop out.
  const requiredIds = useMemo(
    () => filters.requiredIds.filter(id => roster.some(unit => unit.id === id)),
    [filters.requiredIds, roster],
  )
  const search = useMemo(
    () => (roster.length > 0 && ranges.size > 0
      ? {
        roster, ranges, size: filters.size, emblemTraits, craftTools, limit: MAX_RESULTS,
        // Any set of the switched-on evolution traits; fewer ranked first.
        choiceTraits,
        // From my units: the picked units are the player's board, not requirements.
        ...(filters.boardMode
          ? { ownedIds: requiredIds, maxSwaps: tuning.maxSwaps, boardWeights: tuning.boardWeights }
          : { requiredIds }),
      }
      : null),
    [roster, ranges, filters.size, emblemTraits, craftTools, choiceTraits,
      filters.boardMode, requiredIds, tuning],
  )
  const { result, error: searchError, isSearching } = useBronzeSearch(search)
  const championsById = useMemo(() => makeMap(champions), [champions])
  const rowProps = useMemo(
    () => ({ traitByName, traits, champions, championsById, emblemByTrait, toolItems, boardWeights: tuning.boardWeights }),
    [traitByName, traits, champions, championsById, emblemByTrait, toolItems, tuning.boardWeights],
  )

  const isLoading = champs.isLoading || traitsQuery.isLoading || itemsQuery.isLoading
  const isError = champs.isError || traitsQuery.isError || itemsQuery.isError || Boolean(searchError)
  const tooManyRequired = !filters.boardMode && (requiredIds.length > filters.size || result?.tooManyRequired)

  return (
    <section className={styles.page} aria-label={t('bronze.label')}>
      <BronzeFilters
        filters={{ ...filters, requiredIds }}
        setFilter={setFilter}
        resetFilters={resetFilters}
        activeCount={countActiveFilters(filters)}
        pickers={pickers}
        toolItems={toolItems}
        choiceUnitNames={choiceUnits.map(unit => unit.name)}
        choiceOptions={choiceOptions}
        traitByName={traitByName}
        tuning={tuning}
        setTuning={setTuning}
      />
      <div className={styles.resultsColumn}>
        {(isLoading || (isSearching && !result)) && (
          <p className={statsStyles.message} role="status" aria-live="polite">{t(isLoading ? 'bronze.loading' : 'bronze.searching')}</p>
        )}
        {isError && <p className={statsStyles.message} role="alert">{t('bronze.error')}</p>}
        {tooManyRequired && <p className={statsStyles.message} role="status">{t('bronze.tooManyRequired')}</p>}
        {!isLoading && !isError && !isSearching && !tooManyRequired && result?.comps.length === 0 && (
          <p className={statsStyles.message} role="status">{t('bronze.empty')}</p>
        )}
        {result?.truncated && <p className={statsStyles.message} role="status">{t('bronze.truncated')}</p>}
        <BronzeResults result={result} isSearching={isSearching} size={filters.size} rowProps={rowProps} />
      </div>
    </section>
  )
}
