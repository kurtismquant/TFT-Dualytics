import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeGroups from './BronzeGroups.jsx'
import LoadMore from './LoadMore.jsx'
import RecommendedUnits from './RecommendedUnits.jsx'
import { usePlayedBoards } from '../../hooks/usePlayedBoards.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { useUiScale } from '../../contexts/useUiScale.js'
import { HIGHLY_PLAYED_MIN_BOARDS, mergeFormVariants, pageGroups } from '../../utils/bronzeComps.js'
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
// rankBy 'played' orders each trait count by play count instead, and each row
// shows its count. `unitLayout` (from bronzeLayout) sets every row's units.
export default function BronzeResults({ result, isSearching, size, rankBy, rowProps, unitLayout }) {
  const { t } = useTranslation()
  const uiScale = useUiScale()
  const widgetOutside = useMediaQuery(`(min-width: ${Math.round(SIDE_WIDGET_MIN_REM * 16 * uiScale)}px)`)

  // Pages shown and collapsed trait counts, reset whenever a new result arrives.
  const [paging, setPaging] = useState({ result: null, shown: PAGE_SIZE, collapsed: NONE_COLLAPSED })
  const current = paging.result === result ? paging : { shown: PAGE_SIZE, collapsed: NONE_COLLAPSED }
  // comp key -> { count, avgPlacement } this patch; empty until the server's
  // board index answers. Comps played often enough get the star.
  const played = usePlayedBoards(result?.comps)
  const playCounts = useMemo(() => {
    const rows = played.data?.results || []
    return new Map((result?.comps || []).map((comp, i) => [comp.key, rows[i]]).filter(([, row]) => row))
  }, [played.data, result])
  const highlyPlayed = useMemo(
    () => new Map([...playCounts].filter(([, row]) => row.count >= HIGHLY_PLAYED_MIN_BOARDS)),
    [playCounts],
  )
  const byPlays = rankBy === 'played'
  const playsUnavailable = byPlays && (played.isError || played.data?.ready === false)
  // Comps differing only by Lux form become one row listing the forms.
  const merged = useMemo(() => mergeFormVariants(result?.comps || []), [result])
  // Starred comps lead their trait count, ahead of the cost order; or, by
  // plays, the most boards first, a better average place breaking ties (before
  // paging, so a comp deep in the list still shows near the top).
  const ordered = useMemo(() => {
    const plays = comp => playCounts.get(comp.key)?.count || 0
    const avg = comp => playCounts.get(comp.key)?.avgPlacement ?? Infinity
    return merged
      .map((comp, index) => ({ comp, index }))
      .sort((a, b) => b.comp.traitCount - a.comp.traitCount
        || (byPlays
          ? plays(b.comp) - plays(a.comp) || avg(a.comp) - avg(b.comp)
          : Number(highlyPlayed.has(b.comp.key)) - Number(highlyPlayed.has(a.comp.key)))
        || a.index - b.index)
      .map(entry => entry.comp)
  }, [merged, playCounts, highlyPlayed, byPlays])
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

  const groupRowProps = useMemo(() => ({ ...rowProps, unitLayout }), [rowProps, unitLayout])

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
          {playsUnavailable && <p className={styles.legend}>{t('bronze.playsUnavailable')}</p>}
          <BronzeGroups
            groups={page.groups}
            onToggle={toggleGroup}
            rowProps={groupRowProps}
            highlyPlayed={highlyPlayed}
            playCounts={byPlays && played.data?.ready ? playCounts : null}
          />
        </div>
        {page.shownCount < page.visibleTotal && <LoadMore onMore={showMore} shown={page.shownCount} />}
      </div>
      <RecommendedUnits comps={ordered} emblemByTrait={rowProps.emblemByTrait} toolItems={rowProps.toolItems} />
    </div>
  )
}
