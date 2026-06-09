import { useTranslation } from 'react-i18next'
import styles from '../../pages/StatsPage.module.css'
import SortHeader from './SortHeader.jsx'
import StatsTableRow from './StatsTableRow.jsx'

export default function StatsTable({
  type,
  rows,
  maps,
  sort,
  onSort,
  allItems,
  allChampions,
}) {
  const { t } = useTranslation()

  const nameLabel = type === 'units'
    ? t('stats.colUnit')
    : type === 'items' ? t('stats.colItem') : t('stats.colTrait')
  const popularLabel = type === 'units' ? t('stats.colPopularItems') : t('stats.colPopularUnits')
  const popularMap = type === 'units' ? maps.items : maps.champions
  const popularCardType = type === 'units' ? 'items' : 'units'
  const emptyPopularLabel = type === 'units' ? t('stats.noItems') : t('stats.noUnits')
  const descId = `stats-${type}-table-desc`
  const tableTypeLabel = type === 'units'
    ? t('stats.tabUnits')
    : type === 'items' ? t('stats.tabItems') : t('stats.tabTraits')

  return (
    <div className={styles.tableWrap}>
      <p id={descId} className="sr-only">{t('stats.tableDescription')}</p>
      <table className={styles.table} aria-describedby={descId}>
        <caption className="sr-only">{t('stats.tableCaption', { type: tableTypeLabel })}</caption>
        <thead>
          <tr>
            <SortHeader columnKey="name" label={nameLabel} sort={sort} onSort={onSort} />
            <SortHeader columnKey="avgPlacement" label={t('stats.colAvgPlace')} sort={sort} onSort={onSort} />
            <SortHeader columnKey="winRate" label={t('stats.colWinRate')} sort={sort} onSort={onSort} />
            <SortHeader columnKey="frequency" label={t('stats.colFrequency')} sort={sort} onSort={onSort} />
            <th scope="col">{popularLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <StatsTableRow
              key={row.id}
              type={type}
              row={row}
              popularMap={popularMap}
              popularCardType={popularCardType}
              emptyPopularLabel={emptyPopularLabel}
              allItems={allItems}
              allChampions={allChampions}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
