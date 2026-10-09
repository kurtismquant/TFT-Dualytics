import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../ui/SearchInput.jsx'
import ExplorerChip from './ExplorerChip.jsx'
import { rankItemMatches } from '../../utils/itemComboFilter.js'
import { EMPTY_FILTERS, hasFilters, MAX_EXPLORER_FILTERS } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

const MAX_SUGGESTIONS = 8
const EXPLORER_ITEM_CATEGORIES = new Set(['craftable', 'radiant', 'artifact', 'emblem'])

// One search box for units, traits and items, then a chip per active filter.
export default function ExplorerFilters({ filters, setFilters, addFilter, lookups, champions, items, traits }) {
  const { t } = useTranslation()
  const baseId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const candidates = useMemo(() => [
    ...(champions || []).map(c => ({ id: c.id, name: c.name, kind: 'unit', iconUrl: c.iconUrl, inCombos: true })),
    ...(traits || []).map(tr => ({ id: tr.id, name: tr.name, kind: 'trait', iconUrl: tr.iconUrl, inCombos: true })),
    ...(items || [])
      .filter(item => EXPLORER_ITEM_CATEGORIES.has(item.category))
      .map(item => ({ id: item.id, name: item.name, kind: 'item', iconUrl: item.iconUrl, inCombos: true })),
  ], [champions, traits, items])
  const heldItemOptions = useMemo(
    () => (items || []).filter(item => EXPLORER_ITEM_CATEGORIES.has(item.category))
      .slice().sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  )
  const suggestions = useMemo(() => rankItemMatches(text, candidates, MAX_SUGGESTIONS), [text, candidates])
  const showSuggestions = open && suggestions.length > 0

  const pick = candidate => {
    addFilter(candidate.kind, candidate.id)
    setText('')
    setOpen(false)
  }

  const update = (kind, index, next) => {
    const key = `${kind}s`
    const list = filters[key].slice()
    if (next == null) list.splice(index, 1)
    else list[index] = next
    setFilters({ ...filters, [key]: list })
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter' && suggestions[0]) {
      event.preventDefault()
      pick(suggestions[0])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const chips = [
    ...filters.units.map((entry, index) => ({ kind: 'unit', entry, index })),
    ...filters.traits.map((entry, index) => ({ kind: 'trait', entry, index })),
    ...filters.items.map((entry, index) => ({ kind: 'item', entry, index })),
  ]

  return (
    <div className={styles.filters}>
      <div
        className={styles.searchWrap}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      >
        <SearchInput
          value={text}
          onChange={event => { setText(event.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('explorer.searchPlaceholder')}
          aria-label={t('explorer.searchLabel', { count: MAX_EXPLORER_FILTERS })}
          aria-controls={showSuggestions ? `${baseId}-suggestions` : undefined}
          autoComplete="off"
        />
        {showSuggestions && (
          <div id={`${baseId}-suggestions`} className={styles.suggestions} role="group" aria-label={t('explorer.suggestions')}>
            {suggestions.map(candidate => (
              <button key={`${candidate.kind}-${candidate.id}`} type="button" className={styles.suggestion} onClick={() => pick(candidate)}>
                {candidate.iconUrl && <img src={candidate.iconUrl} alt="" className={styles.suggestionIcon} />}
                <span>{candidate.name}</span>
                <span className={styles.suggestionKind}>{t(`explorer.kind.${candidate.kind}`)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <ul className={styles.chips} aria-label={t('explorer.activeFilters')}>
          {chips.map(({ kind, entry, index }) => (
            <ExplorerChip
              key={`${kind}-${kind === 'item' ? entry : entry.id}`}
              kind={kind}
              entry={entry}
              lookups={lookups}
              heldItemOptions={heldItemOptions}
              onChange={next => update(kind, index, next)}
              onRemove={() => update(kind, index, null)}
            />
          ))}
          <li>
            <button type="button" className={styles.clearAll} onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('explorer.clearAll')}
            </button>
          </li>
        </ul>
      )}
      {!hasFilters(filters) && <p className={styles.hint}>{t('explorer.emptyHint')}</p>}
    </div>
  )
}
