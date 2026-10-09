import { useEffect, useRef } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import styles from './EdgeGlow.module.css'

// Faint radial glow that follows the cursor, but only while it's in the empty
// side gutters outside the page's content column. Position is written straight
// to CSS variables on the node, so mouse movement never re-renders React.
function contentBounds() {
  const shell = document.querySelector('[data-page-shell]')
  if (shell) {
    const { left, right } = shell.getBoundingClientRect()
    return { left, right }
  }
  // No PageShell (landing page): fall back to the standard column width.
  const root = getComputedStyle(document.documentElement)
  const width = parseFloat(root.getPropertyValue('--page-max-width')) * parseFloat(root.fontSize)
  const left = (window.innerWidth - width) / 2
  return { left, right: left + width }
}

function GlowLayer() {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    let frame = 0
    let x = 0
    let y = 0

    const update = () => {
      frame = 0
      const { left, right } = contentBounds()
      const inGutter = x < left || x > right
      node.dataset.active = inGutter
      // Freeze the position over content so the glow fades out where it was.
      if (inGutter) {
        node.style.setProperty('--glow-x', `${x}px`)
        node.style.setProperty('--glow-y', `${y}px`)
      }
    }
    const onMove = (e) => {
      x = e.clientX
      y = e.clientY
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onOut = (e) => {
      if (!e.relatedTarget) node.dataset.active = false
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onOut)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onOut)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className={styles.glow} aria-hidden="true" />
}

export function EdgeGlow() {
  const enabled = useMediaQuery(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  )
  return enabled ? <GlowLayer /> : null
}
