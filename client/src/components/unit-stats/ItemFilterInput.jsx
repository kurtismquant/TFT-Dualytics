import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../ui/SearchInput.jsx'
import ItemIcon from '../ItemIcon.jsx'
import { MAX_ITEM_FILTERS, pickItemMatch, rankItemMatches } from '../../utils/itemComboFilter.js'
import styles from './ItemFilterInput.module.css'

const MAX_SUGGESTIONS = 6

// Chip search bar: type an item name and press Enter to add it as a filter
// (up to 3). Backspace on an empty input removes the last chip.
export default function ItemFilterInput({ filterIds, candidates, itemLookup, onChange }) {
  const { t } = useTranslation()
  const baseId = useId()
  const inputRef = useRef(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const full = filterIds.length >= MAX_ITEM_FILTERS
  const suggestions = useMemo(
    () => (full ? [] : rankItemMatches(text, candidates, MAX_SUGGESTIONS)),
    [full, text, candidates]
  )
  const showSuggestions = open && suggestions.length > 0
  const suggestionsId = `${baseId}-suggestions`
  const helpId = `${baseId}-help`

  const nameFor = id => itemLookup.get(id)?.name || id

  const addItem = id => {
    onChange([...filterIds, id])
    setText('')
    setOpen(false)
    setNotice(t('unit.filterAdded', { item: nameFor(id) }))
    inputRef.current?.focus()
  }

  const removeAt = index => {
    const removed = filterIds[index]
    onChange(filterIds.filter((_, i) => i !== index))
    setNotice(t('unit.filterRemoved', { item: nameFor(removed) }))
    inputRef.current?.focus()
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!text.trim()) return
      if (full) {
        setNotice(t('unit.filterMax', { count: MAX_ITEM_FILTERS }))
        return
      }
      const match = pickItemMatch(text, candidates)
      if (match) addItem(match.id)
      else setNotice(t('unit.filterNoItem', { query: text.trim() }))
    } else if (event.key === 'Backspace' && !text && filterIds.length > 0) {
      removeAt(filterIds.length - 1)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close the list once focus leaves the whole widget (not when moving from the
  // input to a suggestion button).
  const handleBlur = event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div className={styles.wrap} onBlur={handleBlur}>
      <p id={helpId} className="sr-only">{t('unit.filterHelp', { count: MAX_ITEM_FILTERS })}</p>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      <div className={styles.field}>
        {filterIds.length > 0 && (
          <ul className={styles.chips} aria-label={t('unit.activeFilters')}>
            {filterIds.map((id, index) => (
              <li key={`${id}-${index}`} className={styles.chip}>
                <ItemIcon item={itemLookup.get(id)} size={18} />
                <span>{nameFor(id)}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeAt(index)}
                  aria-label={t('unit.removeFilter', { item: nameFor(id) })}
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
          onKeyDown={handleKeyDown}
          placeholder={full ? t('unit.filterFullPlaceholder') : t('unit.filterPlaceholder')}
          aria-label={t('unit.filterLabel')}
          aria-describedby={helpId}
          aria-controls={showSuggestions ? suggestionsId : undefined}
          autoComplete="off"
        />
      </div>
      {showSuggestions && (
        <div id={suggestionsId} className={styles.dropdown} role="group" aria-label={t('unit.suggestions')}>
          {suggestions.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              className={styles.suggestion}
              onClick={() => addItem(candidate.id)}
            >
              <ItemIcon item={itemLookup.get(candidate.id)} size={22} />
              <span>{candidate.name}</span>
              {!candidate.inCombos && <span className={styles.suggestionMeta}>{t('unit.notBuilt')}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
