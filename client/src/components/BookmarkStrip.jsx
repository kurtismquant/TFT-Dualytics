import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBookmarkStore } from '../store/bookmarkStore.js'
import { buildSummonerPath } from '../constants/routes.js'
import BookmarkModal from './BookmarkModal.jsx'
import styles from './BookmarkStrip.module.css'

function BookmarkIcon() {
  // Sized via .icon CSS so it matches the edit icon's height (14px); the viewBox
  // keeps the bookmark's natural aspect ratio.
  return (
    <svg viewBox="0 0 14 16" fill="none" className={styles.icon} aria-hidden="true" focusable="false">
      <path d="M2 1h10v14l-5-3.5L2 15V1z" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M1 11l8-8 2 2-8 8H1v-2z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 3l2 2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export default function BookmarkStrip({ activeRegion = 'na' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const bookmarks = useBookmarkStore(s => s.bookmarks)
  const [modalOpen, setModalOpen] = useState(false)

  const handleChipClick = (b) => {
    navigate(buildSummonerPath(b.region, b))
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.strip}>
        <div className={styles.label}>
          <BookmarkIcon />
          <span>{t('bookmarks.label')}</span>
        </div>

        {bookmarks.length === 0 ? (
          <div className={styles.empty} role="status">{t('bookmarks.empty')}</div>
        ) : (
          <div className={styles.chips}>
            {bookmarks.map(b => (
              <button
                key={`${b.gameName}#${b.tagLine}@${b.region}`}
                type="button"
                className={styles.chip}
                onClick={() => handleChipClick(b)}
              >
                {b.gameName}#{b.tagLine}
                <span className={styles.chipRegion}>{b.region.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.editBtn}
          aria-label={t('bookmarks.editAriaLabel')}
          onClick={() => setModalOpen(true)}
        >
          <EditIcon />
        </button>
      </div>

      {modalOpen && (
        <BookmarkModal defaultRegion={activeRegion} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
