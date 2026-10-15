import { memo } from 'react'
import styles from '../../pages/StatsPage.module.css'

// Gradient swatches for the six trait visual tiers. Purely presentational
// data — the domain-side helper `getTraitTierInfo` returns the style id and
// this component decides how to paint it. Silver/unique/gold/prismatic use the
// in-game fills defined in theme.css.
const TIER_GRADIENTS = {
  style1: 'linear-gradient(145deg, #8a5a3b 0%, #4a2f1e 100%)',
  style3: 'var(--trait-silver-bg)',
  style4: 'var(--trait-unique-bg)',
  style5: 'var(--trait-gold-bg)',
  style6: 'var(--trait-prismatic-bg)',
}

function StatsRowIcon({ type, meta, tierStyle }) {
  const isTrait = type === 'traits'
  const isPrismatic = isTrait && tierStyle === 'style6'
  const traitClass = isTrait ? `${styles.traitIcon} ${isPrismatic ? styles.traitIconPrismatic : ''}` : ''
  const iconClass = `${styles.icon} ${traitClass}`
  const fallbackClass = `${styles.fallbackIcon} ${traitClass}`
  const tierBg = isTrait && tierStyle ? TIER_GRADIENTS[tierStyle] : null

  if (!meta?.iconUrl) {
    return (
      <span className={fallbackClass} style={tierBg ? { background: tierBg } : undefined}>
        {meta?.name?.[0] || '?'}
      </span>
    )
  }

  // The prismatic tile is near-white, so the icon is drawn dark as in game.
  // The filter can't sit on the tile itself (it would blacken the fill), so
  // the tile moves to a wrapper span.
  if (isPrismatic) {
    return (
      <span className={iconClass} style={{ background: tierBg }}>
        <img className={styles.traitIconDark} src={meta.iconUrl} alt="" loading="lazy" />
      </span>
    )
  }

  let style
  if (type === 'units' && meta.cost) style = { borderColor: `var(--cost-${meta.cost})` }
  else if (tierBg) style = { background: tierBg }

  return <img className={iconClass} style={style} src={meta.iconUrl} alt="" loading="lazy" />
}

export default memo(StatsRowIcon)
