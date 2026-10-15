import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import { CURRENT_SET } from '../../constants/game.js'
import { championIdsForPlannerCodes, decodeTeamPlannerCode } from '../../utils/teamPlannerCode.js'
import copyStyles from '../shared/CopyTeamCodeButton.module.css'
import styles from './ImportTeamCodeButton.module.css'

// Why a pasted code can't be imported (an i18n key + values), or its unit ids.
function readCode(text, champions) {
  const decoded = decodeTeamPlannerCode(text)
  if (!decoded) return { error: 'builder.importCode.invalid' }
  if (decoded.setNumber !== CURRENT_SET) {
    return { error: 'builder.importCode.wrongSet', values: { set: decoded.setNumber, current: CURRENT_SET } }
  }
  const ids = championIdsForPlannerCodes(decoded.codes, champions)
  return ids.length ? { ids } : { error: 'builder.importCode.noUnits' }
}

// Team Builder toolbar: paste an in-game Team Planner code to load its units.
// The board is replaced as soon as the field holds a valid code (`onImport`
// gets the champion ids); anything else shows why it can't be read.
export default function ImportTeamCodeButton({ champions, onImport }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const panelId = useId()
  const errorId = useId()
  const result = text.trim() ? readCode(text, champions) : null

  useEffect(() => {
    if (!open) return undefined
    inputRef.current?.focus()
    const onPointerDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    setText('')
  }

  const handleChange = (event) => {
    const value = event.target.value
    const read = value.trim() ? readCode(value, champions) : null
    if (read?.ids) {
      onImport(read.ids)
      close()
      return
    }
    setText(value)
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape closes the panel
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}
    >
      <Button
        variant="ghost"
        className={copyStyles.labeled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
        </svg>
        <span>{t('builder.importCode.button')}</span>
      </Button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <label className={styles.label} htmlFor={`${panelId}-input`}>{t('builder.importCode.label')}</label>
          <input
            ref={inputRef}
            id={`${panelId}-input`}
            className={`${styles.input}${result?.error ? ` ${styles.invalid}` : ''}`}
            value={text}
            onChange={handleChange}
            placeholder={t('builder.importCode.placeholder')}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(result?.error)}
            aria-describedby={result?.error ? errorId : undefined}
          />
          {result?.error && (
            <p id={errorId} className={styles.error} role="alert">{t(result.error, result.values)}</p>
          )}
        </div>
      )}
    </div>
  )
}
