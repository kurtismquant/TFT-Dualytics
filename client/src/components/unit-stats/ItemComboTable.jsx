import { useTranslation } from 'react-i18next'
import SortHeader from '../stats/SortHeader.jsx'
import ItemComboRow from './ItemComboRow.jsx'
import statsStyles from '../../pages/StatsPage.module.css'

// Sortable table of a unit's 3-item combos. Reuses the Stats page table styles,
// including hiding the Win / Top 2 columns on mobile.
export default function ItemComboTable({ combos, sort, onSort, itemLookup, allItems, unitName }) {
  const { t } = useTranslation()
  const descId = 'unit-combos-table-desc'

  return (
    <div className={statsStyles.tableWrap}>
      <p id={descId} className="sr-only">{t('stats.tableDescription')}</p>
      <table className={statsStyles.table} aria-describedby={descId}>
        <caption className="sr-only">{t('unit.tableCaption', { unit: unitName })}</caption>
        <thead>
          <tr>
            <th scope="col" className={statsStyles.colName}>{t('unit.colItems')}</th>
            <SortHeader columnKey="avgPlacement" label={t('stats.colAvgPlace')} sort={sort} onSort={onSort} className={statsStyles.colMetric} />
            <SortHeader columnKey="winRate" label={t('stats.colWinRate')} sort={sort} onSort={onSort} className={statsStyles.colWinRate} />
            <SortHeader columnKey="top2Rate" label={t('unit.colTop2')} sort={sort} onSort={onSort} className={statsStyles.colWinRate} />
            <SortHeader columnKey="count" label={t('unit.colGames')} sort={sort} onSort={onSort} className={statsStyles.colMetric} />
          </tr>
        </thead>
        <tbody>
          {combos.map(combo => (
            <ItemComboRow
              key={combo.items.join('|')}
              combo={combo}
              itemLookup={itemLookup}
              allItems={allItems}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
