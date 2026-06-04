import { useTranslation } from 'react-i18next'
import { formatAveragePlacement, formatGames, formatPairings, formatWinRate } from './formatters.js'
import styles from '../CompRow.module.css'

export function HeaderStats({ comp }) {
  const { t } = useTranslation()
  return (
    <div className={styles.headerLeft}>
      <span className={styles.headerStat}>
        {formatGames(comp.playCount, t)}
      </span>
      <span className={styles.headerStatDivider} aria-hidden="true" />
      <span className={styles.headerStat}>
        {formatWinRate(comp.winRate)}
      </span>
      <span className={styles.headerStatDivider} aria-hidden="true" />
      <span className={styles.headerStat}>
        {formatAveragePlacement(comp.avgPlacement)}
      </span>
    </div>
  )
}

export function PartnerStats({ partner, placementClass }) {
  const { t } = useTranslation()
  return (
    <div className={styles.partnerMeta}>
      <span className={`${styles.partnerPlacement} ${placementClass}`}>
        {formatAveragePlacement(partner.avgPlacement)}
      </span>
      <span className={styles.partnerStat}>
        {formatPairings(partner.pairCount, t)}
      </span>
      <span className={styles.partnerStatDivider} aria-hidden="true" />
      <span className={styles.partnerStat}>
        {formatWinRate(partner.winRate)}
      </span>
    </div>
  )
}
