import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import HoverableNameCell from '../stats/HoverableNameCell.jsx'
import { formatAvg, formatDelta, formatPercent } from '../../utils/statsFormatting.js'
import {
  getAvgPlacementColor,
  getAvgPlacementQualityKey,
  getWinRateColor,
  getWinRateQualityKey,
} from '../../utils/statsQuality.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './ItemUnitsTable.module.css'

// One unit holding the item: linked unit cell (hover card), then how those
// boards placed, the change against the unit's own average, and games played.
function ItemUnitRow({ row, champion, allItems, allChampions, patch }) {
  const { t } = useTranslation()
  const name = champion?.name || row.unitId
  const avgValue = formatAvg(row.avgPlacement)
  const avgQuality = t(`stats.metric.${getAvgPlacementQualityKey(row.avgPlacement)}`)
  const winValue = formatPercent(row.winRate)
  const winQuality = t(`stats.metric.${getWinRateQualityKey(row.winRate)}`)
  const delta = row.delta == null ? null : formatDelta(row.delta)
  const deltaClass = delta == null || delta === '0.00' ? '' : row.delta < 0 ? styles.deltaGood : styles.deltaBad

  return (
    <tr>
      <th scope="row" className={statsStyles.rowHeader}>
        <HoverableNameCell
          type="units"
          row={{ id: row.unitId, name, meta: champion }}
          allItems={allItems}
          allChampions={allChampions}
          patch={patch}
        />
      </th>
      <td
        className={`${statsStyles.avg} ${statsStyles.metricValue}`}
        style={{ '--metric-color': getAvgPlacementColor(row.avgPlacement) }}
        aria-label={`${t('stats.colAvgPlace')}: ${avgValue}. ${t('stats.metricLabel')}: ${avgQuality}`}
      >
        {avgValue}
      </td>
      <td
        className={`${styles.delta} ${deltaClass}`}
        aria-label={delta == null ? undefined : t('item.deltaLabel', { value: delta })}
      >
        {delta ?? '—'}
      </td>
      <td
        className={`${statsStyles.metricValue} ${statsStyles.colWinRate}`}
        style={{ '--metric-color': getWinRateColor(row.winRate) }}
        aria-label={`${t('stats.colWinRate')}: ${winValue}. ${t('stats.metricLabel')}: ${winQuality}`}
      >
        {winValue}
      </td>
      <td className={statsStyles.colWinRate}>{formatPercent(row.top2Rate)}</td>
      <td>
        <span>{row.count.toLocaleString()}</span>
        <span className={statsStyles.frequency} title={t('item.share', { value: formatPercent(row.share) })}>
          {formatPercent(row.share)}
        </span>
      </td>
    </tr>
  )
}

export default memo(ItemUnitRow)
