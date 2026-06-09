import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import styles from './Modal.module.css'

/**
 * Shared modal shell: overlay, panel, header (icon + title + close), focus trap,
 * Escape/overlay-click dismissal, and the dialog ARIA wiring. The two modals it
 * backs differ only in chrome knobs (`size`, `blur`, `scrollable`) and whether
 * they portal / lock background scroll. Each modal supplies its own body content
 * (and its own `bodyClassName`), so body styling stays owned by the caller.
 */
export default function Modal({
  titleId,
  title,
  icon,
  onClose,
  closeLabel,
  size = 'sm',
  blur = false,
  scrollable = false,
  portal = false,
  lockScroll = false,
  initialFocusRef,
  bodyClassName,
  bodyProps,
  children,
}) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)

  useFocusTrap({
    active: true,
    rootRef: panelRef,
    initialFocusRef: initialFocusRef || closeButtonRef,
    onEscape: onClose,
  })

  // Lock background scroll while open; restore the previous value on close.
  useEffect(() => {
    if (!lockScroll) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [lockScroll])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const content = (
    <div className={styles.overlay} onClick={handleOverlayClick} role="presentation" data-blur={blur}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-size={size}
        data-scrollable={scrollable}
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            {icon}
            <span id={titleId} className={styles.title}>{title}</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeBtn}
            aria-label={closeLabel}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className={bodyClassName} {...bodyProps}>
          {children}
        </div>
      </div>
    </div>
  )

  return portal ? createPortal(content, document.body) : content
}
