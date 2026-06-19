import { useTranslation } from 'react-i18next'
import styles from '../../pages/StatsPage.module.css'

export default function SortHeader({ columnKey, label, sort, onSort, className }) {
  const { t } = useTranslation()
  const isActive = sort.key === columnKey
  const ariaSort = isActive
    ? sort.direction === 'asc' ? 'ascending' : 'descending'
    : 'none'

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        className={`${styles.sortButton} ${isActive ? styles.sortButtonActive : ''}`}
        type="button"
        onClick={() => onSort(columnKey)}
        aria-label={t('stats.sortBy', { column: label })}
      >
        <span>{label}</span>
        {isActive && <span className={styles.sortMark}>{sort.direction === 'asc' ? 'ASC' : 'DESC'}</span>}
      </button>
    </th>
  )
}
