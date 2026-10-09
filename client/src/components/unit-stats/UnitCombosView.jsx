import { useTranslation } from 'react-i18next'
import ItemComboTable from './ItemComboTable.jsx'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from '../../pages/UnitStatsPage.module.css'

// The unit's 3-item combos within the selected ranges and item filters.
export default function UnitCombosView({
  rows, minGames, isLoading, isError, filterCount, combosExcluded, rangeLimited,
  sort, onSort, itemLookup, allItems, unitName,
}) {
  const { t } = useTranslation()

  return (
    <>
      <h2 className={styles.sectionTitle}>{t('unit.sectionTitle')}</h2>
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('unit.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('unit.error')}</p>}
      {!isLoading && !isError && rows.length === 0 && (
        <p className={styles.notEnough} role="status">
          <strong>{t('unit.notEnoughData')}</strong>
          <span>
            {combosExcluded
              ? t('unit.combosNeedThreeItems')
              : <>
                {filterCount > 0
                  ? t('unit.notEnoughDataFiltered', { count: minGames })
                  : t('unit.notEnoughDataHelp', { count: minGames })}
                {rangeLimited && ` ${t('unit.widenRanges')}`}
              </>}
          </span>
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className={`${statsStyles.meta} ${styles.tableMeta}`}>
            {t('unit.comboCount', { count: rows.length, min: minGames })}
          </p>
          <ItemComboTable
            combos={rows}
            sort={sort}
            onSort={onSort}
            itemLookup={itemLookup}
            allItems={allItems}
            unitName={unitName}
          />
        </>
      )}
    </>
  )
}
