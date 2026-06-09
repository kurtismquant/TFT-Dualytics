import { useTranslation } from 'react-i18next'
import SearchInput from './ui/SearchInput.jsx'
import styles from './CompSearchBar.module.css'

export default function CompSearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
}) {
  const { t } = useTranslation()
  const hasQuery = value.trim().length > 0
  const countLabel = hasQuery
    ? t('comp.searchCountFiltered', { result: resultCount.toLocaleString(), total: totalCount.toLocaleString() })
    : t('comp.searchCount', { count: totalCount.toLocaleString() })
  const countId = 'comp-search-count'

  return (
    <form className={styles.form} role="search" onSubmit={e => e.preventDefault()}>
      <div className={styles.searchLine}>
        <SearchInput
          id="comp-search"
          className={styles.inputWrap}
          type="search"
          aria-label={t('comp.searchAriaLabel')}
          aria-describedby={countId}
          placeholder={t('comp.searchPlaceholder')}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {hasQuery && (
          <button
            className={styles.clearButton}
            type="button"
            onClick={() => onChange('')}
          >
            {t('comp.searchClear')}
          </button>
        )}
        <span id={countId} className={styles.count} role="status" aria-live="polite">
          {countLabel}
        </span>
      </div>
    </form>
  )
}
