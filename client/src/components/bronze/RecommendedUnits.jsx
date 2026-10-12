import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import styles from './BronzeComps.module.css'

function Chevron({ up }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

// Sticky side widget: the units that show up most across the comps in the
// highest trait counts (`traitCounts`, e.g. [11, 10]); see recommendUnits
// (more than 3 when units tie on count and cost). The arrow reveals
// `moreUnits` (up to 10).
export default function RecommendedUnits({ units, moreUnits = units, poolSize, traitCounts }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  if (units.length === 0) return null
  const canExpand = moreUnits.length > units.length
  const shown = expanded && canExpand ? moreUnits : units
  return (
    <aside className={styles.recommended} aria-labelledby="bronze-recommended-heading">
      <h3 id="bronze-recommended-heading" className={styles.recommendedHeading}>{t('bronze.recommendedTitle')}</h3>
      <p className={styles.recommendedNote}>{t('bronze.recommendedNote', { count: poolSize, tiers: traitCounts.join(' & ') })}</p>
      <ul id="bronze-recommended-list" className={styles.recommendedList}>
        {shown.map(({ champion, appearances }) => (
          <li key={champion.id} className={styles.recommendedUnit}>
            <HoverableUnit unit={{ champion }} href={buildUnitPath(champion.id)} />
            <span className={styles.recommendedText}>
              <span className={styles.recommendedName}>{champion.name}</span>
              <span className={styles.recommendedCount}>{t('bronze.recommendedCount', { count: appearances, total: poolSize })}</span>
            </span>
          </li>
        ))}
      </ul>
      {canExpand && (
        <button
          type="button"
          className={styles.recommendedToggle}
          onClick={() => setExpanded(open => !open)}
          aria-expanded={expanded}
          aria-controls="bronze-recommended-list"
        >
          <span>{t(expanded ? 'bronze.recommendedFewer' : 'bronze.recommendedMore')}</span>
          <Chevron up={expanded} />
        </button>
      )}
    </aside>
  )
}
