import { useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageShell } from '../components/layout/PageShell.jsx'
import ItemHeader from '../components/item-stats/ItemHeader.jsx'
import ItemOverview from '../components/item-stats/ItemOverview.jsx'
import ItemUnitsView from '../components/item-stats/ItemUnitsView.jsx'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useItemUnits } from '../hooks/useItemUnits.js'
import { buildItemLookup } from '../utils/itemComboFilter.js'
import statsStyles from './StatsPage.module.css'
import styles from './UnitStatsPage.module.css'

// Per-item stats (/items/:itemId, keyed by Riot apiName): the item's effect,
// stats and recipe, then the units it does best on. The patch lives in the URL
// (?patch=) so views can be shared.
export default function ItemStatsPage() {
  const { t } = useTranslation()
  const { itemId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const patchParam = searchParams.get('patch')

  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data, isLoading, isError } = useItemUnits({ itemId, patch: patchParam })

  // Match data stores apiNames; the lookup is keyed by both apiName and DD id.
  const item = useMemo(() => buildItemLookup(items).get(itemId) || null, [items, itemId])
  const itemName = item?.name || itemId

  // replace: patch tweaks shouldn't each add a browser history entry.
  const setPatch = useCallback(value => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set('patch', value)
      else next.delete('patch')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const patches = data?.patches || []

  return (
    <PageShell>
      <ItemHeader item={item} itemName={itemName} summary={data} />
      <ItemOverview item={item} allItems={items} patch={patchParam} />
      <div className={styles.controls}>
        <select
          className={statsStyles.select}
          value={data?.patch || patchParam || ''}
          onChange={event => { setPatch(event.target.value); event.target.blur() }}
          aria-label={t('stats.patchLabel')}
        >
          {patches.length === 0 && <option value="">{t('stats.noPatch')}</option>}
          {patches.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      <ItemUnitsView
        data={data}
        isLoading={isLoading}
        isError={isError}
        champions={champions}
        allItems={items}
        patch={patchParam}
        itemName={itemName}
      />
    </PageShell>
  )
}
