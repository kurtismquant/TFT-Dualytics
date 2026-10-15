import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoardStore } from '../../store/boardStore.js'
import Button from '../ui/Button.jsx'
import CopyTeamCodeButton from '../shared/CopyTeamCodeButton.jsx'
import ImportTeamCodeButton from './ImportTeamCodeButton.jsx'
import CopyBoardLinkButton from './CopyBoardLinkButton.jsx'
import BoardSummary from './BoardSummary.jsx'
import styles from '../../pages/CompBuilderPage.module.css'

const ARROWS = {
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
}

function HistoryButton({ action, label, disabled, onClick }) {
  return (
    <Button variant="icon" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ARROWS[action]}
      </svg>
    </Button>
  )
}

// Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Text fields keep their
// own undo.
function useUndoShortcuts(undo, redo) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}

// Team Builder header: title and board summary, then the board actions.
export default function BuilderToolbar({ board, champions, teamCode, partners, onImportCode, onAutoArrange }) {
  const { t } = useTranslation()
  const undo = useBoardStore(s => s.undo)
  const redo = useBoardStore(s => s.redo)
  const canUndo = useBoardStore(s => s.past.length > 0)
  const canRedo = useBoardStore(s => s.future.length > 0)
  const clearBoard = useBoardStore(s => s.clearBoard)
  useUndoShortcuts(undo, redo)

  return (
    <div className={styles.toolbar}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('builder.title')}</h1>
        <BoardSummary board={board} champions={champions} partners={partners} />
      </div>
      {/* Wraps onto its own row when the title and buttons don't fit one. */}
      <div className={styles.actions}>
        {/* Shown on every screen size: the mobile board corner only has room for Clear. */}
        <CopyTeamCodeButton code={teamCode} labeled />
        <ImportTeamCodeButton champions={champions} onImport={onImportCode} />
        <CopyBoardLinkButton board={board} />
        <div className={styles.history}>
          <HistoryButton action="undo" label={t('builder.undo')} disabled={!canUndo} onClick={undo} />
          <HistoryButton action="redo" label={t('builder.redo')} disabled={!canRedo} onClick={redo} />
        </div>
        <button className={styles.arrangeBtn} onClick={onAutoArrange}>{t('builder.autoArrange')}</button>
        {/* Desktop position; on mobile this is hidden and re-shown inside the board. */}
        <button className={styles.clearBtn} onClick={clearBoard}>{t('builder.clearBoard')}</button>
      </div>
    </div>
  )
}
