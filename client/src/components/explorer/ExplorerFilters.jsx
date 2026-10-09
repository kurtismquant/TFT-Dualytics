import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../ui/SearchInput.jsx'
import ExplorerChip from './ExplorerChip.jsx'
import { rankItemMatches } from '../../utils/itemComboFilter.js'
import { formatPercent } from '../../utils/statsFormatting.js'
import { EMPTY_FILTERS, hasFilters } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

const MAX_SUGGESTIONS = 8
const QUICK_PICKS = 5
const DROPDOWN_PICKS = 15
const EXPLORER_ITEM_CATEGORIES = new Set(['craftable', 'radiant', 'artifact', 'emblem'])

// One search box for units, traits and items, recommended units beside it (the
// most played on the matching boards; a longer list drops down from the empty,
// focused box), then a chip per active filter.
export default function ExplorerFilters({ filters, setFilters, addFilter, lookups, champions, items, traits, recommended }) {
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
  const picks = useMemo(() => recommended.map(row => ({
    id: row.id,
    kind: 'unit',
    name: lookups.unit.get(row.id)?.name || row.id,
    iconUrl: lookups.unit.get(row.id)?.iconUrl,
    note: formatPercent(row.frequency),
  })), [recommended, lookups])

  const typing = text.trim() !== ''
  const suggestions = useMemo(
    () => (typing ? rankItemMatches(text, candidates, MAX_SUGGESTIONS) : picks.slice(0, DROPDOWN_PICKS)),
    [typing, text, candidates, picks]
  )
  const showSuggestions = open && suggestions.length > 0
  const pickLabel = hasFilters(filters) ? t('explorer.recommendedWith') : t('explorer.recommendedAll')

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
    if (event.key === 'Enter' && typing && suggestions[0]) {
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
      <div className={styles.filterRow}>
        <div
          className={styles.searchWrap}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
        >
          <SearchInput
            value={text}
            onChange={event => { setText(event.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t('explorer.searchPlaceholder')}
            aria-label={t('explorer.searchLabel')}
            aria-controls={showSuggestions ? `${baseId}-suggestions` : undefined}
            aria-expanded={showSuggestions}
            autoComplete="off"
          />
          {showSuggestions && (
            <div
              id={`${baseId}-suggestions`}
              className={styles.suggestions}
              role="group"
              aria-label={typing ? t('explorer.suggestions') : pickLabel}
            >
              {!typing && <p className={styles.suggestionsTitle}>{pickLabel}</p>}
              {suggestions.map(candidate => (
                <button key={`${candidate.kind}-${candidate.id}`} type="button" className={styles.suggestion} onClick={() => pick(candidate)}>
                  {candidate.iconUrl && <img src={candidate.iconUrl} alt="" className={styles.suggestionIcon} />}
                  <span>{candidate.name}</span>
                  <span className={styles.suggestionKind}>{candidate.note ?? t(`explorer.kind.${candidate.kind}`)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {picks.length > 0 && (
          <div className={styles.quickPicks} role="group" aria-label={pickLabel}>
            <span className={styles.quickPicksLabel}>{pickLabel}</span>
            {picks.slice(0, QUICK_PICKS).map(candidate => (
              <button
                key={candidate.id}
                type="button"
                className={styles.quickPick}
                onClick={() => pick(candidate)}
                aria-label={t('explorer.addRecommended', { name: candidate.name, rate: candidate.note })}
                title={`${candidate.name} · ${candidate.note}`}
              >
                {candidate.iconUrl && <img src={candidate.iconUrl} alt="" className={styles.quickPickIcon} />}
                <span className={styles.quickPickName}>{candidate.name}</span>
                <span className={styles.quickPickRate}>{candidate.note}</span>
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
