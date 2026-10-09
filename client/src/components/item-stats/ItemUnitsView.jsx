import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ItemUnitsTable from './ItemUnitsTable.jsx'
import { DEFAULT_ITEM_UNIT_SORT, nextItemUnitSort, sortItemUnits } from '../../utils/itemUnitSort.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from '../../pages/UnitStatsPage.module.css'

// The units an item did best on, with loading / error / not-enough-data states.
export default function ItemUnitsView({ data, isLoading, isError, champions, allItems, patch, itemName }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState(DEFAULT_ITEM_UNIT_SORT)
  const handleSort = useCallback(key => setSort(current => nextItemUnitSort(current, key)), [])
  const minGames = data?.minGames ?? 10
  // Older patches always carry lastUpdated; on the current patch it's missing
  // until the background pass has stored this item.
  const pending = Boolean(data) && !data.lastUpdated

  const rows = useMemo(() => sortItemUnits(data?.units || [], sort), [data?.units, sort])
  const championsById = useMemo(() => new Map((champions || []).map(c => [c.id, c])), [champions])

  return (
    <>
      <h2 className={styles.sectionTitle}>{t('item.unitsTitle')}</h2>
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('item.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('item.error')}</p>}
      {!isLoading && !isError && pending && (
        <p className={styles.notEnough} role="status"><span>{t('item.pending')}</span></p>
      )}
      {!isLoading && !isError && !pending && rows.length === 0 && (
        <p className={styles.notEnough} role="status">
          <strong>{t('unit.notEnoughData')}</strong>
          <span>{t('item.notEnough', { count: minGames })}</span>
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className={`${statsStyles.meta} ${styles.tableMeta}`}>
            {t('item.unitCount', { count: rows.length, min: minGames })}
          </p>
          <ItemUnitsTable
            rows={rows}
            sort={sort}
            onSort={handleSort}
            championsById={championsById}
            allItems={allItems}
            allChampions={champions}
            patch={patch}
            itemName={itemName}
          />
        </>
      )}
    </>
  )
}
