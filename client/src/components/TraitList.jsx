import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useTraits } from '../hooks/useTraits.js'
import { useChampions } from '../hooks/useChampions.js'
import { useHoverCard } from '../hooks/useHoverCard.js'
import TraitCard from './TraitCard.jsx'
import styles from './TraitList.module.css'

const STYLE_TIER = {
  1: 'style1',
  2: 'style2',
  3: 'style3',
  4: 'style4',
  5: 'style5',
  6: 'style6',
}

function resolveBreakpoints(trait) {
  const effects = trait?.effects || []
  return effects
    .map(e => ({
      min: e.minUnits ?? 0,
      style: typeof e.style === 'number' ? STYLE_TIER[e.style] : null,
    }))
    .filter(b => b.min > 0)
    .sort((a, b) => a.min - b.min)
}

function activeTier(breakpoints, count) {
  let tier = null
  for (const b of breakpoints) {
    if (count >= b.min) tier = b.style || 'active'
    else break
  }
  return tier
}

function TraitRow({ row, meta, allChampions }) {
  const { triggerProps, cardProps } = useHoverCard({ meta, count: row.count })
  return (
    <>
      <li
        className={`${styles.trait} ${row.tier ? styles[`tier_${row.tier}`] : styles.tierInactive}`}
        {...triggerProps}
      >
        <div className={styles.iconHex} aria-hidden="true">
          {row.iconUrl && (
            <img src={row.iconUrl} alt="" className={styles.iconImg} draggable={false} />
          )}
          <span className={styles.iconCount}>{row.count}</span>
        </div>
        <div className={styles.info}>
          <span className={styles.traitName}>{row.name}</span>
          {row.breakpoints.length > 0 && (
            <span className={styles.breakpoints}>
              {row.breakpoints.map((b, i) => (
                <span
                  key={b.min}
                  className={`${styles.bp} ${row.count >= b.min ? styles.bpHit : ''}`}
                >
                  {b.min}
                  {i < row.breakpoints.length - 1 && <span className={styles.bpSep}>{'>'}</span>}
                </span>
              ))}
            </span>
          )}
        </div>
      </li>
      {cardProps.isOpen && createPortal(
        <TraitCard {...cardProps} allChampions={allChampions} />,
        document.body
      )}
    </>
  )
}

export default function TraitList({ activeTraits }) {
  const { t } = useTranslation()
  const { data: traitMeta } = useTraits()
  const { data: allChampions } = useChampions()
  const metaByName = new Map((traitMeta || []).map(t => [t.name, t]))

  const rows = Object.entries(activeTraits || {})
    .filter(([, count]) => count > 0)
    .map(([traitId, count]) => {
      const meta = metaByName.get(traitId)
      const breakpoints = resolveBreakpoints(meta)
      return {
        id: traitId,
        name: meta?.name || traitId,
        iconUrl: meta?.iconUrl,
        count,
        breakpoints,
        tier: activeTier(breakpoints, count),
        meta,
      }
    })
    .sort((a, b) => {
      const rank = (t) => {
        if (!t) return 0
        if (t === 'active') return 1
        const n = parseInt(t.replace('style', ''))
        return isNaN(n) ? 1 : n
      }
      return rank(b.tier) - rank(a.tier) || b.count - a.count
    })

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>{t('traits.heading')}</h3>
      {rows.length === 0 ? (
        <p className={styles.empty} role="status">{t('traits.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {rows.map(row => (
            <TraitRow
              key={row.id}
              row={row}
              meta={row.meta}
              allChampions={allChampions || []}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
