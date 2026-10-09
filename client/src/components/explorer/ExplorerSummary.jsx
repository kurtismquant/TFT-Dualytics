import { useTranslation } from 'react-i18next'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor, getWinRateColor } from '../../utils/statsQuality.js'
import { hasFilters } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

// Headline numbers for the matching boards and their team-placement spread.
export default function ExplorerSummary({ data, filters }) {
  const { t } = useTranslation()
  const { boards, totalBoards, avgPlacement, winRate, top2Rate, placements, patch } = data
  const share = totalBoards > 0 ? boards / totalBoards : 0

  if (boards === 0) {
    return <p className={styles.noMatch} role="status">{t('explorer.noMatch')}</p>
  }

  return (
    <div className={styles.summary}>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>{hasFilters(filters) ? t('explorer.matchingBoards') : t('explorer.allBoards')}</dt>
          <dd>
            {boards.toLocaleString()}
            <span className={styles.metricSub}>{t('explorer.ofBoards', { share: formatPercent(share), patch })}</span>
          </dd>
        </div>
        <div className={styles.metric}>
          <dt>{t('stats.colAvgPlace')}</dt>
          <dd style={{ '--metric-color': getAvgPlacementColor(avgPlacement) }} className={styles.colored}>{formatAvg(avgPlacement)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>{t('stats.colWinRate')}</dt>
          <dd style={{ '--metric-color': getWinRateColor(winRate) }} className={styles.colored}>{formatPercent(winRate)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>{t('unit.colTop2')}</dt>
          <dd>{formatPercent(top2Rate)}</dd>
        </div>
      </dl>
      <div className={styles.distribution} role="img" aria-label={t('explorer.distributionLabel', {
        first: formatPercent(placements[0] / boards),
        second: formatPercent(placements[1] / boards),
        third: formatPercent(placements[2] / boards),
        fourth: formatPercent(placements[3] / boards),
      })}>
        {placements.map((count, index) => (
          <div key={index} className={styles.distRow}>
            <span className={styles.distLabel}>{t(`explorer.place.${index + 1}`)}</span>
            <span className={styles.distTrack}>
              <span className={styles.distFill} data-place={index + 1} style={{ width: `${(count / boards) * 100}%` }} />
            </span>
            <span className={styles.distValue}>{formatPercent(count / boards)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
