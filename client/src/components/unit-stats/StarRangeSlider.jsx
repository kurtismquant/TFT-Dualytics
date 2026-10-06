import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { STAR_LEVELS, starRangeSummary } from '../../utils/starRange.js'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import StarRangeReadout from './StarRangeReadout.jsx'
import styles from './StarRangeSlider.module.css'

const STAR_COLORS = {
  1: 'var(--bronze-star-level)',
  2: 'var(--silver-star-level)',
  3: 'var(--gold-star-level)',
}

const clampStar = star => Math.min(3, Math.max(1, star))
const toPercent = star => `${((star - 1) / 2) * 100}%`

// Two-thumb slider over the 1★ / 2★ / 3★ stops. Custom (not two stacked
// <input type="range">) so that when both thumbs sit on the same stop, a drag
// moves whichever thumb the drag direction calls for instead of getting stuck.
export default function StarRangeSlider({ range, onChange, byStar, fallback, disabled }) {
  const { t } = useTranslation()
  const trackRef = useRef(null)
  const dragRef = useRef(null) // { thumb: 'min' | 'max' | null, pointerId }

  const starLabel = star => t('unit.starLevel', { count: star })

  const setThumb = (thumb, star) => {
    const next = thumb === 'min'
      ? { min: Math.min(star, range.max), max: range.max }
      : { min: range.min, max: Math.max(star, range.min) }
    if (next.min !== range.min || next.max !== range.max) onChange(next)
  }

  const starAt = clientX => {
    const rect = trackRef.current.getBoundingClientRect()
    return clampStar(Math.round(((clientX - rect.left) / rect.width) * 2) + 1)
  }

  // Thumbs on the same stop: undecided until the drag picks a direction.
  const pickThumb = star => {
    if (range.min === range.max) {
      if (star === range.min) return null
      return star < range.min ? 'min' : 'max'
    }
    return Math.abs(star - range.min) < Math.abs(star - range.max) ? 'min' : 'max'
  }

  const focusThumb = thumb => {
    trackRef.current.querySelector(`[data-thumb="${thumb}"]`)?.focus()
  }

  const handlePointerDown = event => {
    if (disabled || event.button > 0) return
    // No text selection / native drag-and-drop: either one cancels the pointer
    // stream mid-drag. That also skips the default focus, so focus the thumb.
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const star = starAt(event.clientX)
    const thumb = pickThumb(star)
    dragRef.current = { thumb, pointerId: event.pointerId }
    if (thumb) {
      focusThumb(thumb)
      setThumb(thumb, star)
    }
  }

  const handlePointerMove = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const star = starAt(event.clientX)
    if (!drag.thumb) {
      drag.thumb = pickThumb(star)
      if (drag.thumb) focusThumb(drag.thumb)
    }
    if (drag.thumb) setThumb(drag.thumb, star)
  }

  const endDrag = () => { dragRef.current = null }

  const handleKeyDown = thumb => event => {
    const value = range[thumb]
    const moves = {
      ArrowLeft: value - 1, ArrowDown: value - 1,
      ArrowRight: value + 1, ArrowUp: value + 1,
      Home: thumb === 'min' ? 1 : range.min,
      End: thumb === 'max' ? 3 : range.max,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setThumb(thumb, clampStar(moves[event.key]))
  }

  const levelTip = star => {
    const level = starRangeSummary(byStar, { min: star, max: star })
    if (!level.games) return t('unit.levelNoGames', { level: starLabel(star) })
    return t('unit.levelTip', {
      level: starLabel(star),
      avg: formatAvg(level.avgPlacement),
      win: formatPercent(level.winRate),
      games: level.games.toLocaleString(),
    })
  }

  const thumbProps = thumb => ({
    role: 'slider',
    tabIndex: disabled ? -1 : 0,
    'aria-label': t(thumb === 'min' ? 'unit.minStar' : 'unit.maxStar'),
    'aria-valuemin': 1,
    'aria-valuemax': 3,
    'aria-valuenow': range[thumb],
    'aria-valuetext': starLabel(range[thumb]),
    'aria-disabled': disabled || undefined,
    'data-thumb': thumb,
    onKeyDown: disabled ? undefined : handleKeyDown(thumb),
    className: styles.thumb,
    style: { left: toPercent(range[thumb]), '--star-color': STAR_COLORS[range[thumb]] },
  })

  return (
    <div className={`${styles.wrap} ${disabled ? styles.disabled : ''}`}>
      <p className={styles.label}>{t('unit.starRangeLabel')}</p>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={styles.fill}
          style={{
            left: toPercent(range.min),
            right: `calc(100% - ${toPercent(range.max)})`,
            '--from': STAR_COLORS[range.min],
            '--to': STAR_COLORS[range.max],
          }}
        />
        {STAR_LEVELS.map(star => (
          <span
            key={star}
            className={`${styles.stop} ${star < range.min || star > range.max ? styles.outside : ''} ${byStar?.[star]?.games ? '' : styles.empty}`}
            style={{ left: toPercent(star), '--star-color': STAR_COLORS[star] }}
          />
        ))}
        {/* Raise the thumb that can still move when both share an end stop. */}
        <div {...thumbProps('min')} data-top={range.min === 3 ? '' : undefined} />
        <div {...thumbProps('max')} />
      </div>
      <div className={styles.stopLabels}>
        {STAR_LEVELS.map(star => {
          const tip = levelTip(star)
          return (
            <button
              key={star}
              type="button"
              className={styles.stopButton}
              style={{ left: toPercent(star), '--star-color': STAR_COLORS[star] }}
              onClick={() => onChange({ min: star, max: star })}
              disabled={disabled}
              aria-label={t('unit.showOnlyLevel', { tip })}
            >
              <span aria-hidden="true">{'★'.repeat(star)}</span>
              <span className={styles.tip} aria-hidden="true">{tip}</span>
            </button>
          )
        })}
      </div>
      <StarRangeReadout summary={byStar ? starRangeSummary(byStar, range) : fallback} />
    </div>
  )
}
