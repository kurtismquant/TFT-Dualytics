import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styles from '../../pages/StatsPage.module.css'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import {
  getAvgPlacementColor,
  getAvgPlacementQualityKey,
  getWinRateColor,
  getWinRateQualityKey,
} from '../../utils/statsQuality.js'
import HoverableNameCell from './HoverableNameCell.jsx'
import PopularIcons from './PopularIcons.jsx'

function StatsTableRow({
  type,
  row,
  popularMap,
  popularCardType,
  emptyPopularLabel,
  allItems,
  allChampions,
}) {
  const { t } = useTranslation()

  const avgValue = formatAvg(row.avgPlacement)
  const avgQuality = t(`stats.metric.${getAvgPlacementQualityKey(row.avgPlacement)}`)
  const winRateValue = formatPercent(row.winRate)
  const winRateQuality = t(`stats.metric.${getWinRateQualityKey(row.winRate)}`)

  const popularEntries = type === 'units' ? row.popularItems : row.popularUnits

  return (
    <tr>
      <th scope="row" className={styles.rowHeader}>
        <HoverableNameCell
          type={type}
          row={row}
          allItems={allItems}
          allChampions={allChampions}
        />
      </th>
      <td
        className={`${styles.avg} ${styles.metricValue}`}
        style={{ '--metric-color': getAvgPlacementColor(row.avgPlacement) }}
        aria-label={`${t('stats.colAvgPlace')}: ${avgValue}. ${t('stats.metricLabel')}: ${avgQuality}`}
      >
        {avgValue}
      </td>
      <td
        className={styles.metricValue}
        style={{ '--metric-color': getWinRateColor(row.winRate) }}
        aria-label={`${t('stats.colWinRate')}: ${winRateValue}. ${t('stats.metricLabel')}: ${winRateQuality}`}
      >
        {winRateValue}
      </td>
      <td>
        <span>{row.count.toLocaleString()}</span>
        <span className={styles.frequency}>{formatPercent(row.frequency)}</span>
      </td>
      <td>
        <PopularIcons
          entries={popularEntries}
          map={popularMap}
          emptyLabel={emptyPopularLabel}
          popularCardType={popularCardType}
          allItems={allItems}
        />
      </td>
    </tr>
  )
}

export default memo(StatsTableRow)
