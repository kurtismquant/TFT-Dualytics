import { memo } from 'react'
import styles from '../../pages/StatsPage.module.css'

// Gradient swatches for the six trait visual tiers. Purely presentational
// data — the domain-side helper `getTraitTierInfo` returns the style id and
// this component decides how to paint it.
const TIER_GRADIENTS = {
  style1: 'linear-gradient(145deg, #8a5a3b 0%, #4a2f1e 100%)',
  style3: 'linear-gradient(145deg, #c7c9cc 0%, #6b6d70 100%)',
  style4: 'linear-gradient(145deg, rgba(230, 110, 80, 0.9) 0%, rgba(160, 50, 40, 0.9) 100%)',
  style5: 'linear-gradient(145deg, #e8c55a 0%, #9a7624 100%)',
  style6: 'linear-gradient(145deg, #ff7ae0 0%, #7ad2ff 50%, #fff27a 100%)',
}

function StatsRowIcon({ type, meta, tierStyle }) {
  const isTrait = type === 'traits'
  const iconClass = `${styles.icon} ${isTrait ? styles.traitIcon : ''}`
  const fallbackClass = `${styles.fallbackIcon} ${isTrait ? styles.traitIcon : ''}`
  const tierBg = isTrait && tierStyle ? TIER_GRADIENTS[tierStyle] : null

  if (!meta?.iconUrl) {
    return (
      <span className={fallbackClass} style={tierBg ? { background: tierBg } : undefined}>
        {meta?.name?.[0] || '?'}
      </span>
    )
  }

  let style
  if (type === 'units' && meta.cost) style = { borderColor: `var(--cost-${meta.cost})` }
  else if (tierBg) style = { background: tierBg }

  return <img className={iconClass} style={style} src={meta.iconUrl} alt="" loading="lazy" />
}

export default memo(StatsRowIcon)
