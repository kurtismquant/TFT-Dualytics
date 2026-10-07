import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buildUnitPath } from '../../constants/routes.js'
import styles from './DetailCardShell.module.css'

// Footer link in a unit's detail sheet. Gives touch users a route to the unit
// stats page from anywhere the sheet opens (incl. the builder's long-press).
export default function UnitStatsSheetLink({ unitId, onNavigate }) {
  const { t } = useTranslation()
  return (
    <Link to={buildUnitPath(unitId)} className={styles.footerLink} onClick={onNavigate}>
      {t('unit.viewStatsLink')} →
    </Link>
  )
}
