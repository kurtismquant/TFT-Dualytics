import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buildItemPath } from '../../constants/routes.js'
import styles from './DetailCardShell.module.css'

// Footer link in an item's detail sheet. Gives touch users a route to the item
// stats page from anywhere the sheet opens.
export default function ItemStatsSheetLink({ itemId, onNavigate }) {
  const { t } = useTranslation()
  if (!itemId) return null
  return (
    <Link to={buildItemPath(itemId)} className={styles.footerLink} onClick={onNavigate}>
      {t('item.viewStatsLink')} →
    </Link>
  )
}
