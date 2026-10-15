import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import { boardLink } from '../../hooks/useSharedBoardLink.js'
import { copyText } from '../../utils/clipboard.js'
import copyStyles from '../shared/CopyTeamCodeButton.module.css'

const FEEDBACK_MS = 1800

// Copies a link that opens this exact board: positions, items, 3★ and picked
// traits (a Team Planner code only carries the units).
export default function CopyBoardLinkButton({ board }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle') // idle | copied | failed
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])
  const link = boardLink(board)

  const handleCopy = async () => {
    try {
      await copyText(link)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
  }

  const text = status === 'copied' ? t('builder.link.copied') : status === 'failed' ? t('builder.link.failed') : t('builder.link.copy')
  return (
    <div className={copyStyles.wrap}>
      <Button
        variant="ghost"
        className={`${copyStyles.labeled} ${status === 'copied' ? copyStyles.done : ''}`}
        onClick={handleCopy}
        disabled={!link}
        title={t('builder.link.title')}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
        <span>{text}</span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? t('builder.link.copiedStatus') : status === 'failed' ? t('builder.link.failed') : ''}
      </span>
    </div>
  )
}
