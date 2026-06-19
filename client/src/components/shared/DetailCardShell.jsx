import { useEffect } from 'react'
import styles from './DetailCardShell.module.css'

// Wraps a detail card's content in the right presentation for the device:
//  - 'floating': the desktop hover tooltip, positioned via `style` (fixed top/left).
//  - 'sheet':    a touch-friendly bottom sheet with a dismiss backdrop.
// The caller (UnitCard / ItemCard / TraitCard) renders this around its content and
// is itself rendered into document.body via a portal by the consumer.
export default function DetailCardShell({ mode, style, onClose, cardClassName, label, children }) {
  const isSheet = mode === 'sheet'

  // Escape closes the sheet (keyboard dismissal, alongside the close button).
  useEffect(() => {
    if (!isSheet) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isSheet, onClose])

  if (isSheet) {
    // Close only when the backdrop itself is clicked, not a bubbled click from
    // inside the sheet (so we don't need a stopPropagation handler on the sheet).
    const onBackdropClick = (e) => { if (e.target === e.currentTarget) onClose?.() }
    return (
      // Backdrop dismissal is a pointer enhancement; keyboard users dismiss via
      // the close button or Escape (handled above).
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div className={styles.backdrop} onClick={onBackdropClick}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={label}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cardClassName} style={style} role="tooltip" aria-hidden="true">
      {children}
    </div>
  )
}
