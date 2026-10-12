import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import { compsInTopTraitCounts, recommendUnits } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

function Chevron({ up }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

// Units are counted across every loaded comp in this many of the highest
// trait counts; the arrow reveals up to RECOMMEND_MAX.
const RECOMMEND_TRAIT_TIERS = 2
const RECOMMEND_MAX = 10

// Sticky side widget: the units that show up most across the comps (in list
// order) in the highest trait counts, e.g. every 11- and 10-trait comp; see
// recommendUnits (more than 3 when units tie on count and cost).
export default function RecommendedUnits({ comps }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const pool = useMemo(() => compsInTopTraitCounts(comps, RECOMMEND_TRAIT_TIERS), [comps])
  const units = useMemo(() => recommendUnits(pool.comps), [pool])
  // Never drops a pick the collapsed list shows (ties can exceed 3).
  const moreUnits = useMemo(
    () => recommendUnits(pool.comps, { count: RECOMMEND_MAX }).slice(0, Math.max(RECOMMEND_MAX, units.length)),
    [pool, units],
  )
  const poolSize = pool.comps.length
  const { traitCounts } = pool
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
