import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ItemComboTable from './ItemComboTable.jsx'
import { itemsForRange, unitRangeSummary } from '../../utils/starRange.js'
import { DEFAULT_COMBO_SORT, nextComboSort, sortCombos } from '../../utils/itemComboFilter.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from '../../pages/UnitStatsPage.module.css'

// How each single item does on the unit, within the star / items-held ranges.
export default function UnitItemsView({ data, starRange, itemRange, minGames, isLoading, isError, itemLookup, allItems, unitName, patch }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState(DEFAULT_COMBO_SORT)
  const handleSort = useCallback(key => setSort(current => nextComboSort(current, key)), [])
  const singleItems = data?.singleItems

  const rows = useMemo(() => {
    if (!singleItems) return []
    const unitGames = data.byStarItems
      ? unitRangeSummary(data, starRange, itemRange).games
      : data.games
    return sortCombos(itemsForRange(singleItems, starRange, itemRange, minGames, unitGames), sort)
  }, [data, singleItems, starRange, itemRange, minGames, sort])

  return (
    <>
      <h2 className={styles.sectionTitle}>{t('unit.itemsTitle')}</h2>
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('unit.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('unit.error')}</p>}
      {!isLoading && !isError && singleItems === null && (
        <p className={styles.notEnough} role="status"><span>{t('unit.itemsPending')}</span></p>
      )}
      {!isLoading && !isError && singleItems && rows.length === 0 && (
        <p className={styles.notEnough} role="status">
          <strong>{t('unit.notEnoughData')}</strong>
          <span>{t('unit.itemsNotEnough', { count: minGames })} {t('unit.widenRanges')}</span>
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className={`${statsStyles.meta} ${styles.tableMeta}`}>
            {t('unit.itemCount', { count: rows.length, min: minGames })}
          </p>
          <ItemComboTable
            combos={rows}
            sort={sort}
            onSort={handleSort}
            itemLookup={itemLookup}
            allItems={allItems}
            unitName={unitName}
            patch={patch}
            itemsLabel={t('unit.colItem')}
            caption={t('unit.itemsCaption', { unit: unitName })}
          />
        </>
      )}
    </>
  )
}
