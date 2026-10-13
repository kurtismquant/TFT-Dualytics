import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText } from '../../utils/clipboard.js'
import styles from './CopyRiotIdButton.module.css'

const FEEDBACK_MS = 1800

const ICON_PATHS = {
  idle: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  copied: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  failed: <path d="M6 6l12 12M18 6L6 18" />,
}

// Small icon button that copies a Riot ID ("Name#TAG"). The icon turns into a
// check (or a cross) briefly after a click; a live region announces the result.
export default function CopyRiotIdButton({ gameName, tagLine }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle') // idle | copied | failed
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const riotId = `${gameName}#${tagLine}`

  const handleCopy = async () => {
    try {
      await copyText(riotId)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${status === 'copied' ? styles.done : ''}`}
        onClick={handleCopy}
        title={t('leaderboard.copyRiotId', { riotId })}
        aria-label={t('leaderboard.copyRiotId', { riotId })}
      >
        {/* 1em so the icon follows the rem-based Interface Size scaling. */}
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICON_PATHS[status]}
        </svg>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied'
          ? t('leaderboard.riotIdCopied', { riotId })
          : status === 'failed' ? t('leaderboard.copyFailed') : ''}
      </span>
    </>
  )
}
