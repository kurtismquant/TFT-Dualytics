import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import styles from './BronzeComps.module.css'

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

// Icon button copying the comp's in-game Team Planner code; the icon turns
// into a check (or a cross) briefly after a click. Disabled when a unit has no
// planner code (e.g. asset data cached before codes were served).
export default function CopyCodeButton({ code }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle') // idle | copied | failed
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async () => {
    try {
      await copyText(code)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
  }

  return (
    <div className={styles.copyCell}>
      <Button
        variant="icon"
        className={`${styles.copyButton} ${status === 'copied' ? styles.copyDone : ''}`}
        onClick={handleCopy}
        disabled={!code}
        title={code ? t('bronze.copyTitle', { code }) : t('bronze.copyUnavailable')}
        aria-label={code ? t('bronze.copyLabel') : t('bronze.copyUnavailable')}
      >
        <StatusIcon status={status} />
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? t('bronze.copiedStatus') : status === 'failed' ? t('bronze.copyFailed') : ''}
      </span>
    </div>
  )
}
