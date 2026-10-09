import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buildUnitViewPath, UNIT_VIEWS } from '../../constants/routes.js'
import styles from './UnitStatsNav.module.css'

// Horizontal tabs between a unit's detailed stats. Links keep the current
// query string (patch, star / items-held ranges, item filters).
export default function UnitStatsNav({ unitId, view, search }) {
  const { t } = useTranslation()
  return (
    <nav className={styles.nav} aria-label={t('unit.nav.label')}>
      {UNIT_VIEWS.map(key => (
        <Link
          key={key}
          to={buildUnitViewPath(unitId, key, search)}
          className={styles.link}
          aria-current={view === key ? 'page' : undefined}
          replace
        >
          {t(`unit.nav.${key}`)}
        </Link>
      ))}
    </nav>
  )
}
