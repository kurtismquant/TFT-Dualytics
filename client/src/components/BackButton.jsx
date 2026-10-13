import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from '../pages/UnitStatsPage.module.css'

// Returns to the previous in-app page. React Router gives the first entry of a
// session the key 'default', so a direct landing (new tab, pasted link) goes
// to `fallback` instead of leaving the site.
export default function BackButton({ fallback }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = () => {
    if (location.key === 'default') navigate(fallback)
    else navigate(-1)
  }

  return (
    <button type="button" onClick={handleClick} className={styles.backLink}>
      ← {t('nav.back')}
    </button>
  )
}
