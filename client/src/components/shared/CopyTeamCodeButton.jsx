import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import styles from './CopyTeamCodeButton.module.css'

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

function StatusIcon({ status }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[status]}
    </svg>
  )
}

// navigator.clipboard needs a secure context (https or localhost); the hidden
// textarea + execCommand path covers anything else.
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('copy failed')
}

// Copies a board's in-game Team Planner code (utils/teamPlannerCode.js). An
// icon by default; `labeled` adds text (the Team Builder toolbar). The icon
// turns into a check (or a cross) briefly after a click. Disabled when there's
// no code (no unit with a planner code, e.g. assets cached before codes were
// served). Clicks don't reach row/card expand handlers. `className` is for the
// wrapper's placement in the parent layout.
export default function CopyTeamCodeButton({ code, labeled = false, className = '' }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle') // idle | copied | failed
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async event => {
    event.stopPropagation()
    try {
      await copyText(code)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
  }

  const text = status === 'copied' ? t('teamCode.copied') : status === 'failed' ? t('teamCode.copyFailed') : t('teamCode.copy')
  return (
    <div className={`${styles.wrap} ${className}`}>
      <Button
        variant={labeled ? 'ghost' : 'icon'}
        className={`${labeled ? styles.labeled : styles.icon} ${status === 'copied' ? styles.done : ''}`}
        onClick={handleCopy}
        disabled={!code}
        title={code ? t('teamCode.title', { code }) : t('teamCode.unavailable')}
        aria-label={code ? t('teamCode.label') : t('teamCode.unavailable')}
      >
        <StatusIcon status={status} />
        {labeled && <span aria-hidden="true">{text}</span>}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? t('teamCode.copiedStatus') : status === 'failed' ? t('teamCode.copyFailed') : ''}
      </span>
    </div>
  )
}
