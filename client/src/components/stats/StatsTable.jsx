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
            {/* On mobile (--bp-md) the table is fixed-layout: name gives up width so
                Avg Placement + Frequency share equal, roomier columns. */}
            <SortHeader columnKey="name" label={nameLabel} sort={sort} onSort={onSort} className={styles.colName} />
            <SortHeader columnKey="avgPlacement" label={t('stats.colAvgPlace')} sort={sort} onSort={onSort} className={styles.colMetric} />
            {/* Win Rate + Popular are hidden on mobile (--bp-md) to keep the table on-screen. */}
            <SortHeader columnKey="winRate" label={t('stats.colWinRate')} sort={sort} onSort={onSort} className={styles.colWinRate} />
            <SortHeader columnKey="frequency" label={t('stats.colFrequency')} sort={sort} onSort={onSort} className={styles.colMetric} />
            <th scope="col" className={styles.colPopular}>{popularLabel}</th>
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
