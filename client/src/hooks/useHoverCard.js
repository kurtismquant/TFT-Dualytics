import { useState, useRef, useEffect, useCallback } from 'react'
import { useBoardStore } from '../store/boardStore.js'
import { useMediaQuery } from './useMediaQuery.js'

// Below this width the 280px floating card can't fit beside an element without
// running off-screen, so we switch to the bottom sheet. Touch devices always use
// the sheet (no hover). Keep the width in sync with --bp-md.
const COMPACT_QUERY = '(max-width: 720px), (pointer: coarse)'

const CARD_WIDTH = 280
const CARD_HEIGHT = 340
const LONG_PRESS_MS = 450
const MOVE_TOLERANCE_SQ = 100 // (10px)^2 — small jitter shouldn't cancel a long-press

function computePosition(rect) {
  let left = rect.right + 12
  let top = rect.top + rect.height / 2 - CARD_HEIGHT / 2

  if (left + CARD_WIDTH > window.innerWidth - 8) {
    left = rect.left - CARD_WIDTH - 12
  }

  if (top < 8) top = 8
  if (top + CARD_HEIGHT > window.innerHeight - 8) {
    top = window.innerHeight - 8 - CARD_HEIGHT
  }

  return { top, left }
}

/**
 * Detail card trigger. On wide, hover-capable screens it's the positioned
 * floating tooltip (open on hover, close on leave). On narrow screens or touch
 * devices — where the floating card has no hover and/or lands off-screen — it
 * instead opens a bottom sheet (cardProps.mode === 'sheet'), triggered by tap
 * or, where a tap is already used for something else (the builder's
 * place/select), a long-press.
 *
 * Spread the returned `triggerProps` on the trigger element and pass `cardProps`
 * to the card component (UnitCard / ItemCard / TraitCard).
 */
export function useHoverCard(data, { delay = 300, touchTrigger = 'tap', anchorRef } = {}) {
  const isDragging = useBoardStore(s => s.isDragging)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const isCompact = useMediaQuery(COMPACT_QUERY)
  const timerRef = useRef(null)
  const pressPosRef = useRef(null)

  useEffect(() => {
    if (isDragging) {
      clearTimeout(timerRef.current)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false)
    }
  }, [isDragging])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const close = useCallback(() => {
    clearTimeout(timerRef.current)
    setIsOpen(false)
  }, [])

  // ── Desktop: hover (floating card) ──────────────────────────────────────
  // Capture the DOM element synchronously from the event before it's nulled.
  const onMouseEnter = useCallback((e) => {
    if (isDragging) return
    const element = e.currentTarget
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Anchor to a specific child (e.g. the icon) when provided, so the card
      // sits next to it rather than the right edge of a wide trigger (the stats
      // name cell spans the whole column).
      const rect = (anchorRef?.current ?? element)?.getBoundingClientRect()
      if (!rect) return
      setPosition(computePosition(rect))
      setIsOpen(true)
    }, delay)
  }, [isDragging, delay, anchorRef])

  // ── Touch: bottom sheet (tap or long-press) ─────────────────────────────
  const openSheet = useCallback(() => {
    if (isDragging) return
    setIsOpen(true)
  }, [isDragging])

  const onTap = useCallback((e) => {
    // Don't let the tap also trigger a parent action (row expand, etc.).
    e.stopPropagation()
    openSheet()
  }, [openSheet])

  const onPointerDown = useCallback((e) => {
    pressPosRef.current = { x: e.clientX, y: e.clientY }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      openSheet()
      // Swallow the click that fires when the finger lifts so it doesn't also
      // run the trigger's own onClick (e.g. place a unit in the builder).
      const swallow = (ev) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      document.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 700)
    }, LONG_PRESS_MS)
  }, [openSheet])

  const onPointerMove = useCallback((e) => {
    const start = pressPosRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (dx * dx + dy * dy > MOVE_TOLERANCE_SQ) clearTimeout(timerRef.current)
  }, [])

  const cancelLongPress = useCallback(() => {
    clearTimeout(timerRef.current)
    pressPosRef.current = null
  }, [])

  let triggerProps
  if (!isCompact) {
    triggerProps = { onMouseEnter, onMouseLeave: close }
  } else if (touchTrigger === 'longpress') {
    triggerProps = {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancelLongPress,
      onPointerLeave: cancelLongPress,
      onPointerCancel: cancelLongPress,
      onContextMenu: (e) => e.preventDefault(),
    }
  } else {
    triggerProps = { onClick: onTap }
  }

  return {
    triggerProps,
    cardProps: {
      isOpen,
      data,
      mode: isCompact ? 'sheet' : 'floating',
      onClose: close,
      style: { position: 'fixed', zIndex: 9999, top: position.top, left: position.left },
    },
  }
}
