import { useEffect, useId, useRef, useState } from 'react'
import styles from './TraitPicker.module.css'

// Unit inspector dropdown for traits chosen in game: Lux's form (single, a
// radio list) or Kha'Zix's evolutions (multiple, a checklist). Highlighted, and
// open on first show, until something is picked.
// options: [{ value, trait (name, for the icon), label }].
export default function TraitPicker({ label, placeholder, options, selected, multiple = false, onToggle, traitByName }) {
  const [open, setOpen] = useState(selected.length === 0)
  const rootRef = useRef(null)
  const listId = useId()
  const empty = selected.length === 0

  // Click outside or Escape closes the list (Escape stays here, so it doesn't
  // also close the inspector).
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])
  const onKeyDown = (e) => {
    if (e.key !== 'Escape' || !open) return
    e.stopPropagation()
    setOpen(false)
  }

  const chosen = options.filter(option => selected.includes(option.value))
  const icon = trait => {
    const url = traitByName?.get(trait)?.iconUrl
    return url ? <img src={url} alt="" className={styles.icon} draggable={false} /> : null
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape handling for the list inside
    <div ref={rootRef} className={styles.picker} onKeyDown={onKeyDown}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={`${styles.toggle}${empty ? ` ${styles.highlight}` : ''}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(value => !value)}
      >
        <span className={styles.summary}>
          {empty ? placeholder : chosen.map(option => (
            <span key={option.value} className={styles.chip}>{icon(option.trait)}{option.label}</span>
          ))}
        </span>
        <span className={styles.caret} aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <fieldset id={listId} className={styles.list}>
          <legend className="sr-only">{label}</legend>
          {options.map(option => (
            <label key={option.value} className={styles.option}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={listId}
                className={styles.input}
                checked={selected.includes(option.value)}
                onChange={() => {
                  onToggle(option.value)
                  if (!multiple) setOpen(false)
                }}
              />
              {icon(option.trait)}
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}
