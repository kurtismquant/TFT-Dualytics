import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UnitIcon from '../UnitIcon.jsx'
import StarRangeSlider from './StarRangeSlider.jsx'
import { ROUTES } from '../../constants/routes.js'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from '../../pages/UnitStatsPage.module.css'

export default function UnitHeader({ champion, unitName, starRange, onStarRangeChange, byStar, fallback }) {
  const { t } = useTranslation()
  const traits = champion?.traits || []

  return (
    <div className={styles.header}>
      <Link to={ROUTES.comps} className={styles.backLink}>← {t('unit.backToComps')}</Link>
      <div className={styles.identity}>
        {champion && <UnitIcon champion={champion} size={72} />}
        <div className={styles.identityText}>
          <p className={statsStyles.eyebrow}>{t('unit.eyebrow')}</p>
          <h1 className={statsStyles.title}>{unitName}</h1>
          {champion && (
            <p className={styles.details}>
              <span className={styles.cost} style={{ '--cost-color': `var(--cost-${champion.cost})` }}>
                {t('unit.cost', { cost: champion.cost })}
              </span>
              {traits.length > 0 && <span>{traits.join(' · ')}</span>}
            </p>
          )}
        </div>
      </div>
      {/* Without per-star data (a doc stored before it existed) the slider is
          disabled and the readout falls back to the all-stars game counts. */}
      <StarRangeSlider
        range={starRange}
        onChange={onStarRangeChange}
        byStar={byStar}
        fallback={fallback}
        disabled={!byStar}
      />
    </div>
  )
}
