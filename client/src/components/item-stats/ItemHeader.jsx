import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ItemIcon from '../ItemIcon.jsx'
import { buildStatsPath } from '../../constants/routes.js'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor, getWinRateColor } from '../../utils/statsQuality.js'
import statsStyles from '../../pages/StatsPage.module.css'
import unitStyles from '../../pages/UnitStatsPage.module.css'
import readoutStyles from '../unit-stats/UnitRangeReadout.module.css'

// Back link, icon, name and category, with the item's overall placement on the
// right (every board any unit held it on, for the selected patch).
export default function ItemHeader({ item, itemName, summary }) {
  const { t } = useTranslation()
  const { games = 0, avgPlacement = null, winRate = null } = summary || {}
  const hasRates = avgPlacement != null

  return (
    <div className={unitStyles.header}>
      <Link to={buildStatsPath('items')} className={unitStyles.backLink}>← {t('item.backToStats')}</Link>
      <div className={unitStyles.identity}>
        {item && <ItemIcon item={item} size={72} />}
        <div className={unitStyles.identityText}>
          <p className={statsStyles.eyebrow}>{t('item.eyebrow')}</p>
          <h1 className={statsStyles.title}>{itemName}</h1>
          {item?.category && (
            <p className={unitStyles.details}>
              <span>{t(`item.category.${item.category}`, { defaultValue: item.category })}</span>
            </p>
          )}
        </div>
      </div>
      <div className={readoutStyles.readout} aria-live="polite">
        <p className={readoutStyles.metrics}>
          <span className={readoutStyles.metric}>
            <span className={readoutStyles.metricLabel}>{t('item.readoutAvg')}</span>
            <span style={{ '--metric-color': hasRates ? getAvgPlacementColor(avgPlacement) : undefined }} className={readoutStyles.metricValue}>
              {hasRates ? formatAvg(avgPlacement) : '—'}
            </span>
          </span>
          <span className={readoutStyles.metric}>
            <span className={readoutStyles.metricLabel}>{t('item.readoutWin')}</span>
            <span style={{ '--metric-color': hasRates ? getWinRateColor(winRate) : undefined }} className={readoutStyles.metricValue}>
              {hasRates ? formatPercent(winRate) : '—'}
            </span>
          </span>
        </p>
        <p className={readoutStyles.counts}>{t('item.games', { count: games })}</p>
      </div>
    </div>
  )
}
