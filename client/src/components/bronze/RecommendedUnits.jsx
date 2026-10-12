import { useTranslation } from 'react-i18next'
import { HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import styles from './BronzeComps.module.css'

// Sticky side widget: the units that show up most in the top comps listed
// (see recommendUnits; more than 3 when units tie on count and cost).
export default function RecommendedUnits({ units, poolSize }) {
  const { t } = useTranslation()
  if (units.length === 0) return null
  return (
    <aside className={styles.recommended} aria-labelledby="bronze-recommended-heading">
      <h3 id="bronze-recommended-heading" className={styles.recommendedHeading}>{t('bronze.recommendedTitle')}</h3>
      <p className={styles.recommendedNote}>{t('bronze.recommendedNote', { count: poolSize })}</p>
      <ul className={styles.recommendedList}>
        {units.map(({ champion, appearances }) => (
          <li key={champion.id} className={styles.recommendedUnit}>
            <HoverableUnit unit={{ champion }} href={buildUnitPath(champion.id)} />
            <span className={styles.recommendedText}>
              <span className={styles.recommendedName}>{champion.name}</span>
              <span className={styles.recommendedCount}>{t('bronze.recommendedCount', { count: appearances, total: poolSize })}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
