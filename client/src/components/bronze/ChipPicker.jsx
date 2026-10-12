import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../ui/SearchInput.jsx'
import { rankItemMatches } from '../../utils/itemComboFilter.js'
import styles from '../unit-stats/ItemFilterInput.module.css'

// Chip picker (emblems, required units): focus to see every option, type to
// narrow, click or press Enter to add. With `allowDuplicates` an option can be
// added more than once. Backspace on an empty input removes the last chip;
// ArrowDown enters the list. `i18nKey` prefixes the copy (bronze.<key>Label…).
export default function ChipPicker({ selectedIds, options, renderIcon, nameFor, onChange, max, allowDuplicates = false, i18nKey }) {
  const { t } = useTranslation()
  const copy = (suffix, values) => t(`bronze.${i18nKey}${suffix}`, values)
  const baseId = useId()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const full = selectedIds.length >= max
  const suggestions = useMemo(() => {
    if (full) return []
    const available = allowDuplicates ? options : options.filter(option => !selectedIds.includes(option.id))
    return text.trim() ? rankItemMatches(text, available, available.length) : available
  }, [allowDuplicates, full, options, selectedIds, text])
  const showSuggestions = open && suggestions.length > 0
  const suggestionsId = `${baseId}-suggestions`
  const helpId = `${baseId}-help`

  const add = id => {
    onChange([...selectedIds, id])
    setText('')
    setNotice(copy('Added', { name: nameFor(id) }))
    inputRef.current?.focus()
  }

  const removeAt = index => {
    const removed = selectedIds[index]
    onChange(selectedIds.filter((_, i) => i !== index))
    setNotice(copy('Removed', { name: nameFor(removed) }))
    inputRef.current?.focus()
  }

  const focusSuggestion = index => {
    const buttons = listRef.current?.querySelectorAll('button')
    if (!buttons?.length) return
    buttons[Math.max(0, Math.min(index, buttons.length - 1))].focus()
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (full) {
        setNotice(copy('Max', { count: max }))
        return
      }
      if (!text.trim()) return
      if (suggestions[0]) add(suggestions[0].id)
      else setNotice(copy('NoMatch', { query: text.trim() }))
    } else if (event.key === 'Backspace' && !text && selectedIds.length > 0) {
      removeAt(selectedIds.length - 1)
    } else if (event.key === 'ArrowDown' && showSuggestions) {
      event.preventDefault()
      focusSuggestion(0)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleListKeyDown = event => {
    const buttons = [...(listRef.current?.querySelectorAll('button') || [])]
    const index = buttons.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusSuggestion(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index <= 0) inputRef.current?.focus()
      else focusSuggestion(index - 1)
    } else if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.focus()
    }
  }

  // Close the list once focus leaves the whole widget (not when moving from the
  // input to a suggestion button).
  const handleBlur = event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div className={styles.wrap} onBlur={handleBlur}>
      <p id={helpId} className="sr-only">{copy('Help', { count: max })}</p>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      <div className={styles.field}>
        {selectedIds.length > 0 && (
          <ul className={styles.chips} aria-label={copy('Active')}>
            {selectedIds.map((id, index) => (
              <li key={`${id}-${index}`} className={styles.chip}>
                {renderIcon(id, 22)}
                <span>{nameFor(id)}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeAt(index)}
                  aria-label={copy('Remove', { name: nameFor(id) })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <SearchInput
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={event => { setText(event.target.value); setOpen(true); setNotice('') }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={full ? copy('FullPlaceholder') : copy('Placeholder')}
          aria-label={copy('Label')}
          aria-describedby={helpId}
          aria-controls={showSuggestions ? suggestionsId : undefined}
          autoComplete="off"
        />
      </div>
      {showSuggestions && (
        <div
          id={suggestionsId}
          ref={listRef}
          className={styles.dropdown}
          role="group"
          aria-label={copy('Suggestions')}
        >
          {suggestions.map(option => (
            <button
              key={option.id}
              type="button"
              className={styles.suggestion}
              onClick={() => add(option.id)}
              onKeyDown={handleListKeyDown}
            >
              {renderIcon(option.id, 26)}
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
