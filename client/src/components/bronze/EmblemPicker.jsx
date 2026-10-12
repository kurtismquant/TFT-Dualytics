import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../ui/SearchInput.jsx'
import ItemIcon from '../ItemIcon.jsx'
import { rankItemMatches } from '../../utils/itemComboFilter.js'
import { MAX_EMBLEMS } from '../../utils/bronzeComps.js'
import styles from '../unit-stats/ItemFilterInput.module.css'

// Emblem chip picker: focus to see every emblem, type to narrow, click or press
// Enter to add. The same emblem can be added more than once (each is +1).
// Backspace on an empty input removes the last chip; ArrowDown enters the list.
export default function EmblemPicker({ emblemIds, options, itemLookup, onChange }) {
  const { t } = useTranslation()
  const baseId = useId()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const full = emblemIds.length >= MAX_EMBLEMS
  const suggestions = useMemo(() => {
    if (full) return []
    return text.trim() ? rankItemMatches(text, options, options.length) : options
  }, [full, text, options])
  const showSuggestions = open && suggestions.length > 0
  const suggestionsId = `${baseId}-suggestions`
  const helpId = `${baseId}-help`

  const nameFor = id => itemLookup.get(id)?.name || id

  const addEmblem = id => {
    onChange([...emblemIds, id])
    setText('')
    setNotice(t('bronze.emblemAdded', { emblem: nameFor(id) }))
    inputRef.current?.focus()
  }

  const removeAt = index => {
    const removed = emblemIds[index]
    onChange(emblemIds.filter((_, i) => i !== index))
    setNotice(t('bronze.emblemRemoved', { emblem: nameFor(removed) }))
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
        setNotice(t('bronze.emblemMax', { count: MAX_EMBLEMS }))
        return
      }
      if (!text.trim()) return
      if (suggestions[0]) addEmblem(suggestions[0].id)
      else setNotice(t('bronze.emblemNoMatch', { query: text.trim() }))
    } else if (event.key === 'Backspace' && !text && emblemIds.length > 0) {
      removeAt(emblemIds.length - 1)
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
      <p id={helpId} className="sr-only">{t('bronze.emblemHelp', { count: MAX_EMBLEMS })}</p>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      <div className={styles.field}>
        {emblemIds.length > 0 && (
          <ul className={styles.chips} aria-label={t('bronze.activeEmblems')}>
            {emblemIds.map((id, index) => (
              <li key={`${id}-${index}`} className={styles.chip}>
                <ItemIcon item={itemLookup.get(id)} size={22} />
                <span>{nameFor(id)}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeAt(index)}
                  aria-label={t('bronze.removeEmblem', { emblem: nameFor(id) })}
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
          placeholder={full ? t('bronze.emblemFullPlaceholder') : t('bronze.emblemPlaceholder')}
          aria-label={t('bronze.emblemLabel')}
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
          aria-label={t('bronze.emblemSuggestions')}
        >
          {suggestions.map(option => (
            <button
              key={option.id}
              type="button"
              className={styles.suggestion}
              onClick={() => addEmblem(option.id)}
              onKeyDown={handleListKeyDown}
            >
              <ItemIcon item={itemLookup.get(option.id)} size={26} />
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
