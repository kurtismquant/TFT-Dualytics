import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiGet } from '../api/client.js'
import { useBookmarkStore } from '../store/bookmarkStore.js'
import { usePlayerSearch } from '../hooks/usePlayerSearch.js'
import { parseRiotIdWithDefaultTag } from '../utils/riotSearch.js'
import RegionSelect from './ui/RegionSelect.jsx'
import Modal from './ui/Modal.jsx'
import styles from './BookmarkModal.module.css'

export default function BookmarkModal({ defaultRegion = 'na', onClose }) {
  const { t } = useTranslation()
  const bookmarks = useBookmarkStore(s => s.bookmarks)
  const addBookmark = useBookmarkStore(s => s.addBookmark)
  const removeBookmark = useBookmarkStore(s => s.removeBookmark)

  const [region, setRegion] = useState(defaultRegion || 'na')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef(null)
  const errorId = 'bookmark-search-error'
  const statusId = 'bookmark-search-status'
  const suggestionId = 'bookmark-search-suggestions'
  const regionHelpId = 'bookmark-search-region-help'
  const inputHelpId = 'bookmark-search-input-help'

  const { data: suggestions, isFetching } = usePlayerSearch(query)
  const showDropdown =
    query.trim().length >= 2 && (suggestions?.length ?? 0) > 0
  const statusText = verifying
    ? t('bookmarks.verifying')
    : isFetching && query.trim().length >= 2
      ? t('bookmarks.searching')
      : showDropdown
        ? t('search.candidatesFound', { count: suggestions.length })
        : ''
  const inputDescriptionIds = [
    inputHelpId,
    error ? errorId : null,
    statusText ? statusId : null,
  ].filter(Boolean).join(' ')

  const handlePickSuggestion = (s) => {
    addBookmark({ gameName: s.gameName, tagLine: s.tagLine, region })
    setQuery('')
    setError('')
  }

  const handleManualAdd = async () => {
    setError('')
    const id = parseRiotIdWithDefaultTag(query, region)
    if (!id) {
      setError(t('bookmarks.addError'))
      return
    }
    setVerifying(true)
    try {
      await apiGet(
        `/api/summoner/${region}/${encodeURIComponent(id.gameName)}/${encodeURIComponent(id.tagLine)}`
      )
      addBookmark({ gameName: id.gameName, tagLine: id.tagLine, region })
      setQuery('')
    } catch (err) {
      setError(err?.response?.data?.error || t('bookmarks.notFound'))
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && showDropdown) {
      e.stopPropagation()
      setQuery('')
      setError('')
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const exact = (suggestions || []).find(
        s => `${s.gameName}#${s.tagLine}`.toLowerCase() === query.trim().toLowerCase()
      )
      if (exact) handlePickSuggestion(exact)
      else handleManualAdd()
    }
  }

  return (
    <Modal
      titleId="bookmark-modal-title"
      title={t('bookmarks.modalTitle')}
      onClose={onClose}
      closeLabel={t('bookmarks.close')}
      size="md"
      blur
      scrollable
      portal
      lockScroll
      initialFocusRef={inputRef}
      bodyClassName={styles.body}
      bodyProps={{ 'aria-busy': verifying || isFetching }}
    >
      <p id={regionHelpId} className="sr-only">{t('search.regionHelp')}</p>
          <p id={inputHelpId} className="sr-only">{t('search.riotIdHelp')}</p>
          <p id={statusId} className="sr-only" role="status" aria-live="polite">
            {statusText}
          </p>
          <div className={styles.searchRow}>
            <RegionSelect
              className={styles.select}
              value={region}
              onChange={e => setRegion(e.target.value)}
              aria-label={t('search.regionLabel')}
              aria-describedby={regionHelpId}
            />
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder={t('bookmarks.placeholder')}
              value={query}
              onChange={e => { setQuery(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              aria-label={t('search.riotIdLabel')}
              aria-invalid={!!error}
              aria-describedby={inputDescriptionIds || undefined}
              maxLength={22}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.addBtn}
              disabled={verifying || !query.trim()}
              onClick={handleManualAdd}
            >
              {verifying ? '...' : t('bookmarks.add')}
            </button>

            {showDropdown && (
              <div
                id={suggestionId}
                className={styles.dropdown}
                role="group"
                aria-label={t('search.candidatePrompt')}
              >
                {suggestions.map(s => (
                  <button
                    type="button"
                    key={`${s.gameName}#${s.tagLine}`}
                    className={styles.suggestion}
                    onClick={() => handlePickSuggestion(s)}
                  >
                    <span>{s.gameName}#{s.tagLine}</span>
                    {s.tier && (
                      <span className={styles.suggestionMeta}>
                        {s.tier}{s.rank ? ' ' + s.rank : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
          {isFetching && query.trim().length >= 2 && !suggestions?.length && (
            <p className={styles.searching} role="status" aria-live="polite">{t('bookmarks.searching')}</p>
          )}

          <h3 className={styles.sectionHeader}>{t('bookmarks.sectionHeader')}</h3>
          <div className={styles.list}>
            {bookmarks.length === 0 ? (
              <div className={styles.emptyList} role="status">{t('bookmarks.noBookmarks')}</div>
            ) : (
              bookmarks.map(b => (
                <div key={`${b.gameName}#${b.tagLine}@${b.region}`} className={styles.row}>
                  <div>
                    <span className={styles.rowName}>{b.gameName}#{b.tagLine}</span>
                    <span className={styles.rowRegion}>{b.region.toUpperCase()}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label={t('bookmarks.removeAriaLabel', { name: `${b.gameName}#${b.tagLine}` })}
                    onClick={() => removeBookmark(b)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
    </Modal>
  )
}
