import { useTranslation } from 'react-i18next'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import {
  getAvgPlacementColor,
  getAvgPlacementQualityKey,
  getWinRateColor,
  getWinRateQualityKey,
} from '../../utils/statsQuality.js'
import styles from '../CompRow.module.css'

// Play rate is shown as a decimal ratio with two decimal places (e.g. 0.90)
// rather than a percentage.
const formatRatio = value => (value || 0).toFixed(2)

// Single right-aligned stat block shared by main comp rows and partner rows.
// Play rate is neutral (popularity, not quality); win rate and avg placement
// reuse the Stats-page color bands via the --metric-color CSS custom property.
export default function CompStatBlock({ playRate, winRate, avgPlacement }) {
  const { t } = useTranslation()

  const winQuality = t(`stats.metric.${getWinRateQualityKey(winRate)}`)
  const avgQuality = t(`stats.metric.${getAvgPlacementQualityKey(avgPlacement)}`)

  return (
    <div className={styles.statBlock}>
      <div className={styles.statItem}>
        <span
          className={styles.statValue}
          aria-label={`${t('comp.statPlayRate')}: ${formatRatio(playRate)}`}
        >
          {formatRatio(playRate)}
        </span>
        <span className={styles.statLabel} aria-hidden="true">{t('comp.statPlayRate')}</span>
      </div>

      <div className={styles.statItem}>
        <span
          className={styles.statValue}
          style={{ '--metric-color': getAvgPlacementColor(avgPlacement) }}
          aria-label={`${t('stats.colAvgPlace')}: ${formatAvg(avgPlacement)}. ${t('stats.metricLabel')}: ${avgQuality}`}
        >
          {formatAvg(avgPlacement)}
        </span>
        <span className={styles.statLabel} aria-hidden="true">{t('comp.statAvg')}</span>
      </div>

      <div className={`${styles.statItem} ${styles.statWin}`}>
        <span
          className={styles.statValue}
          style={{ '--metric-color': getWinRateColor(winRate) }}
          aria-label={`${t('stats.colWinRate')}: ${formatPercent(winRate)}. ${t('stats.metricLabel')}: ${winQuality}`}
        >
          {formatPercent(winRate)}
        </span>
        <span className={styles.statLabel} aria-hidden="true">{t('comp.statWin')}</span>
      </div>
    </div>
  )
}
