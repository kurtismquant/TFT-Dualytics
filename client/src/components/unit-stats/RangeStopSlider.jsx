import { useRef } from 'react'
import styles from './RangeStopSlider.module.css'

// Two-thumb slider over a few discrete stops (1★-3★, 0-3 items). Custom (not two
// stacked <input type="range">) so that when both thumbs sit on the same stop, a
// drag moves whichever thumb the drag direction calls for instead of getting stuck.
//
// levels: ascending stop values. range: { min, max } within them.
// colorFor(level) -> CSS colour, stopContent(level) -> label node,
// valueText(level) -> spoken value, tipFor(level) -> hover text for that level,
// isEmpty(level) -> true when the level has no games (hollow stop).
export default function RangeStopSlider({
  label,
  levels,
  range,
  onChange,
  disabled,
  minLabel,
  maxLabel,
  colorFor,
  stopContent,
  valueText,
  tipFor,
  selectLabel,
  isEmpty,
}) {
  const trackRef = useRef(null)
  const dragRef = useRef(null) // { thumb: 'min' | 'max' | null, pointerId }
  const lo = levels[0]
  const hi = levels[levels.length - 1]
  const clamp = level => Math.min(hi, Math.max(lo, level))
  const toPercent = level => `${((level - lo) / (hi - lo)) * 100}%`

  const setThumb = (thumb, level) => {
    const next = thumb === 'min'
      ? { min: Math.min(level, range.max), max: range.max }
      : { min: range.min, max: Math.max(level, range.min) }
    if (next.min !== range.min || next.max !== range.max) onChange(next)
  }

  const levelAt = clientX => {
    const rect = trackRef.current.getBoundingClientRect()
    return clamp(Math.round(((clientX - rect.left) / rect.width) * (hi - lo)) + lo)
  }

  // Thumbs on the same stop: undecided until the drag picks a direction.
  const pickThumb = level => {
    if (range.min === range.max) {
      if (level === range.min) return null
      return level < range.min ? 'min' : 'max'
    }
    return Math.abs(level - range.min) < Math.abs(level - range.max) ? 'min' : 'max'
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
    const level = levelAt(event.clientX)
    const thumb = pickThumb(level)
    dragRef.current = { thumb, pointerId: event.pointerId }
    if (thumb) {
      focusThumb(thumb)
      setThumb(thumb, level)
    }
  }

  const handlePointerMove = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const level = levelAt(event.clientX)
    if (!drag.thumb) {
      drag.thumb = pickThumb(level)
      if (drag.thumb) focusThumb(drag.thumb)
    }
    if (drag.thumb) setThumb(drag.thumb, level)
  }

  const endDrag = () => { dragRef.current = null }

  const handleKeyDown = thumb => event => {
    const value = range[thumb]
    const moves = {
      ArrowLeft: value - 1, ArrowDown: value - 1,
      ArrowRight: value + 1, ArrowUp: value + 1,
      Home: thumb === 'min' ? lo : range.min,
      End: thumb === 'max' ? hi : range.max,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setThumb(thumb, clamp(moves[event.key]))
  }

  const thumbProps = thumb => ({
    role: 'slider',
    tabIndex: disabled ? -1 : 0,
    'aria-label': thumb === 'min' ? minLabel : maxLabel,
    'aria-valuemin': lo,
    'aria-valuemax': hi,
    'aria-valuenow': range[thumb],
    'aria-valuetext': valueText(range[thumb]),
    'aria-disabled': disabled || undefined,
    'data-thumb': thumb,
    onKeyDown: disabled ? undefined : handleKeyDown(thumb),
    className: styles.thumb,
    style: { left: toPercent(range[thumb]), '--stop-color': colorFor(range[thumb]) },
  })

  return (
    <div className={`${styles.wrap} ${disabled ? styles.disabled : ''}`}>
      <p className={styles.label}>{label}</p>
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
            '--from': colorFor(range.min),
            '--to': colorFor(range.max),
          }}
        />
        {levels.map(level => (
          <span
            key={level}
            className={`${styles.stop} ${level < range.min || level > range.max ? styles.outside : ''} ${isEmpty(level) ? styles.empty : ''}`}
            style={{ left: toPercent(level), '--stop-color': colorFor(level) }}
          />
        ))}
        {/* Raise the thumb that can still move when both share the top stop. */}
        <div {...thumbProps('min')} data-top={range.min === hi ? '' : undefined} />
        <div {...thumbProps('max')} />
      </div>
      <div className={styles.stopLabels}>
        {levels.map(level => {
          const tip = tipFor(level)
          return (
            <button
              key={level}
              type="button"
              className={styles.stopButton}
              style={{ left: toPercent(level), '--stop-color': colorFor(level) }}
              onClick={() => onChange({ min: level, max: level })}
              disabled={disabled}
              aria-label={selectLabel(tip)}
            >
              <span aria-hidden="true">{stopContent(level)}</span>
              <span className={styles.tip} aria-hidden="true">{tip}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
