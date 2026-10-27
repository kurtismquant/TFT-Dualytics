import { useTranslation } from 'react-i18next'
import styles from './BronzeComps.module.css'

// Highly played: a small gold star in the row's left gutter.
export function PlayedStar({ played }) {
  const { t } = useTranslation()
  const label = t('bronze.highlyPlayedTitle', { count: played.count, avg: played.avgPlacement?.toFixed(2) })
  return (
    <span className={styles.playedStar} title={label}>
      <span aria-hidden="true">★</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

// Most played: how many boards fielded this exact team this patch, on its own
// line under the units.
export function PlayCount({ plays }) {
  const { t } = useTranslation()
  return (
    <p className={styles.playCount}>
      {plays.count > 0
        ? t('bronze.playCount', { count: plays.count, avg: plays.avgPlacement?.toFixed(2) })
        : t('bronze.playCountNone')}
    </p>
  )
}
