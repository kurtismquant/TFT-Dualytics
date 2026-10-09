import { useTranslation } from 'react-i18next'
import SortHeader from '../stats/SortHeader.jsx'
import ItemUnitRow from './ItemUnitRow.jsx'
import statsStyles from '../../pages/StatsPage.module.css'

// Sortable table of the units an item was held by. Reuses the Stats page table
// styles, including hiding the Win / Top 2 columns on mobile.
export default function ItemUnitsTable({ rows, sort, onSort, championsById, allItems, allChampions, patch, itemName }) {
  const { t } = useTranslation()
  const descId = 'item-units-table-desc'

  return (
    <div className={statsStyles.tableWrap}>
      <p id={descId} className="sr-only">{t('stats.tableDescription')}</p>
      <table className={statsStyles.table} aria-describedby={descId}>
        <caption className="sr-only">{t('item.unitsCaption', { item: itemName })}</caption>
        <thead>
          <tr>
            <th scope="col" className={statsStyles.colName}>{t('item.colUnit')}</th>
            <SortHeader columnKey="avgPlacement" label={t('stats.colAvgPlace')} sort={sort} onSort={onSort} className={statsStyles.colMetric} />
            <SortHeader columnKey="delta" label={t('item.colDelta')} sort={sort} onSort={onSort} className={statsStyles.colMetric} />
            <SortHeader columnKey="winRate" label={t('stats.colWinRate')} sort={sort} onSort={onSort} className={statsStyles.colWinRate} />
            <SortHeader columnKey="top2Rate" label={t('unit.colTop2')} sort={sort} onSort={onSort} className={statsStyles.colWinRate} />
            <SortHeader columnKey="count" label={t('unit.colGames')} sort={sort} onSort={onSort} className={statsStyles.colMetric} />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <ItemUnitRow
              key={row.unitId}
              row={row}
              champion={championsById.get(row.unitId) || null}
              allItems={allItems}
              allChampions={allChampions}
              patch={patch}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
