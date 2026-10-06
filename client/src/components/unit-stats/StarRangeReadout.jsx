import { useTranslation } from 'react-i18next'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor, getWinRateColor } from '../../utils/statsQuality.js'
import styles from './StarRangeSlider.module.css'

// Avg placement / win rate / game counts for the selected star range.
// Rates are null when the range has no games (or the doc predates star data).
export default function StarRangeReadout({ summary }) {
  const { t } = useTranslation()
  const { games = 0, threeItemGames = 0, avgPlacement = null, winRate = null } = summary || {}
  const hasRates = avgPlacement != null

  return (
    <div className={styles.readout} aria-live="polite">
      <p className={styles.metrics}>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{t('unit.readoutAvg')}</span>
          <span style={{ '--metric-color': hasRates ? getAvgPlacementColor(avgPlacement) : undefined }} className={styles.metricValue}>
            {hasRates ? formatAvg(avgPlacement) : '—'}
          </span>
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>{t('unit.readoutWin')}</span>
          <span style={{ '--metric-color': hasRates ? getWinRateColor(winRate) : undefined }} className={styles.metricValue}>
            {hasRates ? formatPercent(winRate) : '—'}
          </span>
        </span>
      </p>
      <p className={styles.counts}>
        {t('unit.gamesSummary', { games: games.toLocaleString(), builds: threeItemGames.toLocaleString() })}
      </p>
    </div>
  )
}
