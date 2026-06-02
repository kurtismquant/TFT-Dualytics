import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatsTable from '../components/stats/StatsTable.jsx'
import StatsToolbar from '../components/stats/StatsToolbar.jsx'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useStats } from '../hooks/useStats.js'
import { useTraits } from '../hooks/useTraits.js'
import { makeMap, normalizeName } from '../utils/statsFormatting.js'
import { compareRows, DEFAULT_SORT, nextSort } from '../utils/statsSort.js'
import { getTraitTierInfo } from '../utils/traitTier.js'
import styles from './StatsPage.module.css'

// Items in this collection are filtered from the items table.
// `TFT_Item_EmptyBag` is a Riot internal placeholder, not a real item.
const ITEM_BLACKLIST = new Set(['TFT_Item_EmptyBag'])

function buildTraitRow(row, traitsMap) {
  const traitId = row.traitId || row.id
  const meta = traitsMap.get(traitId)
  const { minUnits, style } = getTraitTierInfo(meta, row.tier)
  const baseName = meta?.name || traitId
  const name = minUnits != null ? `${minUnits} ${baseName}` : baseName
  return { ...row, meta, name, tierStyle: style, tierMin: minUnits }
}

function buildSimpleRow(row, assetMap) {
  const meta = assetMap.get(row.id)
  return { ...row, meta, name: meta?.name || row.id }
}

export default function StatsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('units')
  const [selectedPatch, setSelectedPatch] = useState(null)
  const [query, setQuery] = useState('')
  const [costFilter, setCostFilter] = useState(null)
  const [itemCategory, setItemCategory] = useState('craftable')
  const [sort, setSort] = useState(DEFAULT_SORT)

  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data: traits } = useTraits()
  const { data, isLoading, isError } = useStats({ type: activeTab, patch: selectedPatch })

  // Stable id->meta lookups. Rebuilt only when the underlying lists change,
  // not on every keystroke or sort flip.
  const maps = useMemo(() => ({
    champions: makeMap(champions),
    items: makeMap(items),
    traits: makeMap(traits),
  }), [champions, items, traits])

  const rows = useMemo(() => {
    const assetMap = activeTab === 'units'
      ? maps.champions
      : activeTab === 'items' ? maps.items : maps.traits
    const needle = normalizeName(query)
    const isItemTab = activeTab === 'items'
    const isUnitTab = activeTab === 'units'

    const decorated = (data?.rows || []).map(row => (
      activeTab === 'traits'
        ? buildTraitRow(row, maps.traits)
        : buildSimpleRow(row, assetMap)
    ))

    const filtered = decorated.filter(row => {
      if (isItemTab) {
        if (ITEM_BLACKLIST.has(row.id)) return false
        if ((row.meta?.category || 'other') !== itemCategory) return false
      }
      if (isUnitTab && costFilter && row.meta?.cost !== costFilter) return false
      if (needle && !normalizeName(row.name).includes(needle)
        && !normalizeName(row.id).includes(needle)) return false
      return true
    })

    return filtered.sort((a, b) => compareRows(a, b, sort))
  }, [activeTab, costFilter, data?.rows, itemCategory, maps, query, sort])

  const handleSort = useCallback(columnKey => {
    setSort(current => nextSort(current, columnKey))
  }, [])

  const patches = data?.patches || []
  const patch = data?.patch || selectedPatch
  const matchCount = (data?.matchCount || 0).toLocaleString()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('stats.eyebrow')}</p>
          <h1 className={styles.title}>{t('stats.title')}</h1>
        </div>
        <div className={styles.meta}>{t('stats.gamesAnalyzed', { count: matchCount })}</div>
      </div>
      <StatsToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        patch={patch}
        patches={patches}
        setPatch={setSelectedPatch}
        query={query}
        setQuery={setQuery}
        costFilter={costFilter}
        setCostFilter={setCostFilter}
        itemCategory={itemCategory}
        setItemCategory={setItemCategory}
      />
      {isLoading && <p className={styles.message} role="status" aria-live="polite">{t('stats.loading')}</p>}
      {isError && <p className={styles.message} role="alert">{t('stats.error')}</p>}
      {!isLoading && !isError && rows.length === 0
        && <p className={styles.message} role="status">{t('stats.empty')}</p>}
      {rows.length > 0 && (
        <StatsTable
          type={activeTab}
          rows={rows}
          maps={maps}
          sort={sort}
          onSort={handleSort}
          allItems={items}
          allChampions={champions}
        />
      )}
    </div>
  )
}
