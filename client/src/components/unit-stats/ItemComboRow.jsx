import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { HoverableItem } from '../shared/HoverableBoardPieces.jsx'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import {
  getAvgPlacementColor,
  getAvgPlacementQualityKey,
  getWinRateColor,
  getWinRateQualityKey,
} from '../../utils/statsQuality.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './ItemComboTable.module.css'

function ItemComboRow({ combo, itemLookup, allItems }) {
  const { t } = useTranslation()
  const names = combo.items.map(id => itemLookup.get(id)?.name || id)
  const avgValue = formatAvg(combo.avgPlacement)
  const avgQuality = t(`stats.metric.${getAvgPlacementQualityKey(combo.avgPlacement)}`)
  const winValue = formatPercent(combo.winRate)
  const winQuality = t(`stats.metric.${getWinRateQualityKey(combo.winRate)}`)

  return (
    <tr>
      <th scope="row" className={statsStyles.rowHeader}>
        <div className={styles.itemsCell}>
          {combo.items.map((id, i) => {
            const item = itemLookup.get(id)
            return item
              ? <HoverableItem key={i} item={item} allItems={allItems} size={30} />
              : <span key={i} className={styles.missingItem} title={id} aria-hidden="true">?</span>
          })}
          <span className="sr-only">{names.join(', ')}</span>
        </div>
      </th>
      <td
        className={`${statsStyles.avg} ${statsStyles.metricValue}`}
        style={{ '--metric-color': getAvgPlacementColor(combo.avgPlacement) }}
        aria-label={`${t('stats.colAvgPlace')}: ${avgValue}. ${t('stats.metricLabel')}: ${avgQuality}`}
      >
        {avgValue}
      </td>
      <td
        className={`${statsStyles.metricValue} ${statsStyles.colWinRate}`}
        style={{ '--metric-color': getWinRateColor(combo.winRate) }}
        aria-label={`${t('stats.colWinRate')}: ${winValue}. ${t('stats.metricLabel')}: ${winQuality}`}
      >
        {winValue}
      </td>
      <td className={statsStyles.colWinRate}>{formatPercent(combo.top2Rate)}</td>
      <td>
        <span>{combo.count.toLocaleString()}</span>
        <span className={statsStyles.frequency}>{formatPercent(combo.frequency)}</span>
      </td>
    </tr>
  )
}

export default memo(ItemComboRow)
