import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeGroups from './BronzeGroups.jsx'
import LoadMore from './LoadMore.jsx'
import RecommendedUnits from './RecommendedUnits.jsx'
import { usePlayedBoards } from '../../hooks/usePlayedBoards.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { useUiScale } from '../../contexts/useUiScale.js'
import { HIGHLY_PLAYED_MIN_BOARDS, pageGroups } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

// The list shows PAGE_SIZE more comps each time the user scrolls to its end.
const PAGE_SIZE = 20
const NONE_COLLAPSED = new Set()
// Window width (rem) from which the recommended-units widget fits in the
// right margin outside the wide (90rem) page: the page plus two margins each
// holding the 9.5rem widget, its 1.25rem gap and 0.75rem of room, less the
// 2rem page gutter, plus ~1rem for a scrollbar. Media queries ignore the root
// font-size, so it's converted with the Interface Size factor (16px per rem
// at Compact). Narrower windows show the widget above the list.
const SIDE_WIDGET_MIN_REM = 110

// Results: trait-count groups (collapsible, paged), the highly-played star
// (starred comps lead their trait count) and the recommended-units widget.
export default function BronzeResults({ result, isSearching, size, rowProps }) {
  const { t } = useTranslation()
  const uiScale = useUiScale()
  const widgetOutside = useMediaQuery(`(min-width: ${Math.round(SIDE_WIDGET_MIN_REM * 16 * uiScale)}px)`)

  // Pages shown and collapsed trait counts, reset whenever a new result arrives.
  const [paging, setPaging] = useState({ result: null, shown: PAGE_SIZE, collapsed: NONE_COLLAPSED })
  const current = paging.result === result ? paging : { shown: PAGE_SIZE, collapsed: NONE_COLLAPSED }
  // comp key -> { count, avgPlacement } for comps played often enough to star.
  const played = usePlayedBoards(result?.comps)
  const highlyPlayed = useMemo(() => {
    const map = new Map()
    const rows = played.data?.results || []
    result?.comps.forEach((comp, i) => {
      if ((rows[i]?.count || 0) >= HIGHLY_PLAYED_MIN_BOARDS) map.set(comp.key, rows[i])
    })
    return map
  }, [played.data, result])
  // Starred comps lead their trait count, ahead of the cost order (before
  // paging, so a starred comp deep in the list still shows near the top).
  const ordered = useMemo(() => (result?.comps || [])
    .map((comp, index) => ({ comp, index }))
    .sort((a, b) => b.comp.traitCount - a.comp.traitCount
      || Number(highlyPlayed.has(b.comp.key)) - Number(highlyPlayed.has(a.comp.key))
      || a.index - b.index)
    .map(entry => entry.comp), [result, highlyPlayed])
  const page = useMemo(() => pageGroups(ordered, current.shown, current.collapsed), [ordered, current.shown, current.collapsed])
  const showMore = useCallback(() => setPaging(prev => {
    const base = prev.result === result ? prev : { shown: PAGE_SIZE, collapsed: NONE_COLLAPSED }
    if (base.shown >= page.visibleTotal) return prev
    return { result, collapsed: base.collapsed, shown: Math.min(base.shown + PAGE_SIZE, page.visibleTotal) }
  }), [result, page.visibleTotal])
  const toggleGroup = useCallback(traitCount => setPaging(prev => {
    const base = prev.result === result ? prev : { shown: PAGE_SIZE, collapsed: NONE_COLLAPSED }
    const collapsed = new Set(base.collapsed)
    if (collapsed.has(traitCount)) collapsed.delete(traitCount)
    else collapsed.add(traitCount)
    return { result, shown: base.shown, collapsed }
  }), [result])

  if (!result?.comps.length) return null
  return (
    <div className={styles.resultsLayout} data-widget={widgetOutside ? 'outside' : 'inline'}>
      <div className={styles.resultsMain}>
        <div
          className={`${styles.list} ${isSearching ? styles.updating : ''}`}
          aria-busy={isSearching}
          aria-label={t('bronze.resultsLabel', { count: size })}
          role="region"
        >
          <p className={styles.legend}>
            <span className={styles.legendStar} aria-hidden="true">★</span>
            {t('bronze.legendHighlyPlayed', { count: HIGHLY_PLAYED_MIN_BOARDS })}
          </p>
          <BronzeGroups groups={page.groups} onToggle={toggleGroup} rowProps={rowProps} highlyPlayed={highlyPlayed} />
        </div>
        {page.shownCount < page.visibleTotal && <LoadMore onMore={showMore} shown={page.shownCount} />}
      </div>
      <RecommendedUnits comps={ordered} emblemByTrait={rowProps.emblemByTrait} toolItems={rowProps.toolItems} />
    </div>
  )
}
