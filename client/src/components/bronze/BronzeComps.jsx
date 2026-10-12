import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeControls from './BronzeControls.jsx'
import BronzeCompRow from './BronzeCompRow.jsx'
import { useChampions } from '../../hooks/useChampions.js'
import { useItems } from '../../hooks/useItems.js'
import { useTraits } from '../../hooks/useTraits.js'
import { toBuilderRoster } from '../../utils/builderRoster.js'
import { bronzeRanges, buildEmblemOptions, findBronzeComps } from '../../utils/bronzeComps.js'
import { makeMap } from '../../utils/statsFormatting.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './BronzeComps.module.css'

const DEFAULT_SIZE = 8

// Bronze for Life: comps of N units with the most traits sitting in their
// bronze tier. Computed in the browser from the static asset lists; the search
// (utils/bronzeComps.js) takes well under 100ms on Set 18.
export default function BronzeComps() {
  const { t } = useTranslation()
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [emblemIds, setEmblemIds] = useState([])

  const champs = useChampions()
  const traitsQuery = useTraits()
  const itemsQuery = useItems()
  const champions = champs.data
  const traits = traitsQuery.data
  const items = itemsQuery.data

  // Same roster as the builder: base Lux dropped, forms count double.
  const roster = useMemo(() => toBuilderRoster(champions || []), [champions])
  const ranges = useMemo(() => bronzeRanges(traits), [traits])
  const emblemOptions = useMemo(() => buildEmblemOptions(items, ranges), [items, ranges])
  const itemLookup = useMemo(() => makeMap(items), [items])
  const traitByName = useMemo(() => new Map((traits || []).map(trait => [trait.name, trait])), [traits])
  const emblemTraits = useMemo(() => {
    const traitById = new Map(emblemOptions.map(option => [option.id, option.trait]))
    return emblemIds.map(id => traitById.get(id)).filter(Boolean)
  }, [emblemIds, emblemOptions])

  const result = useMemo(
    () => (roster.length > 0 && ranges.size > 0
      ? findBronzeComps({ roster, ranges, size, emblemTraits })
      : null),
    [roster, ranges, size, emblemTraits],
  )

  const isLoading = champs.isLoading || traitsQuery.isLoading || itemsQuery.isLoading
  const isError = champs.isError || traitsQuery.isError || itemsQuery.isError

  return (
    <section className={styles.page} aria-label={t('bronze.label')}>
      <p className={styles.intro}>{t('bronze.intro')}</p>
      <BronzeControls
        size={size}
        setSize={setSize}
        emblemIds={emblemIds}
        setEmblemIds={setEmblemIds}
        emblemOptions={emblemOptions}
        itemLookup={itemLookup}
      />
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('bronze.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('bronze.error')}</p>}
      {!isLoading && !isError && result?.comps.length === 0 && (
        <p className={statsStyles.message} role="status">{t('bronze.empty')}</p>
      )}
      {result?.truncated && <p className={statsStyles.message} role="status">{t('bronze.truncated')}</p>}
      {result?.comps.length > 0 && (
        <ol className={styles.list} aria-label={t('bronze.resultsLabel', { count: size })}>
          {result.comps.map((comp, index) => (
            <BronzeCompRow
              key={comp.units.map(unit => unit.champion.id).join('|')}
              comp={comp}
              rank={index + 1}
              traitByName={traitByName}
              traits={traits}
              champions={champions}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
