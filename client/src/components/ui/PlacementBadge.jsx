import styles from './PlacementBadge.module.css'

/**
 * Colored placement label (1st–4th). The color tokens are defined once here
 * so every surface (match card, participant row) stays in sync when placement
 * colors change. Pass `size="sm"` for compact scoreboard rows.
 */
export default function PlacementBadge({ placement, label, size }) {
  const colorClass = styles[`p${placement}`] || ''
  const sizeClass = size === 'sm' ? styles.sm : ''
  return (
    <span className={[styles.badge, colorClass, sizeClass].filter(Boolean).join(' ')}>
      {label}
    </span>
  )
}
