import styles from './UnitIcon.module.css'

const COST_COLORS = {
  1: 'var(--cost-1)',
  2: 'var(--cost-2)',
  3: 'var(--cost-3)',
  4: 'var(--cost-4)',
  5: 'var(--cost-5)',
}

export default function UnitIcon2({
  champion,
  size = 56,
  showName = false,
  tier,
  variant = 'rect',
  floatStars = false,
  onClick,
  onContextMenu,
}) {
  if (!champion) return null
  const borderColor = COST_COLORS[champion.cost] || 'var(--bg-border)'
  const handleKeyDown = (event) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick(event)
  }
  const interactiveProps = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
        'aria-label': champion.name,
      }
    : {}

  if (variant === 'hex') {
    return (
      <div
        className={styles.hexBorder}
        style={{ background: borderColor }}
        onContextMenu={onContextMenu}
        {...interactiveProps}
      >
        <div className={styles.hexInner}>
          <img
            src={champion.iconUrl}
            alt={champion.name}
            className={styles.hexImg}
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
    )
  }

  const iconEl = (
    <div
      className={styles.icon}
      style={{ width: size, height: size, borderColor }}
      onContextMenu={onContextMenu}
      {...interactiveProps}
    >
      <img
        src={champion.iconUrl}
        alt={champion.name}
        className={styles.img}
        loading="lazy"
      />
      {showName && <span className={styles.name}>{champion.name}</span>}
    </div>
  )

  if (!tier) return iconEl

  return (
    <div className={`${styles.wrapper}${floatStars ? ` ${styles.floatStars}` : ''}`} style={{ width: size }}>
      <div className={styles.stars} data-tier={tier}>
        {Array.from({ length: tier }).map((_, i) => (
          <span key={i} className={styles.star}>★</span>
        ))}
      </div>
      {iconEl}
    </div>
  )
}
