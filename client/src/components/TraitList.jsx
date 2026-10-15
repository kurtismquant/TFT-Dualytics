import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useTraits } from '../hooks/useTraits.js'
import { useChampions } from '../hooks/useChampions.js'
import { useHoverCard } from '../hooks/useHoverCard.js'
import TraitCard from './TraitCard.jsx'
import { traitBreakpoints } from '../utils/traitTier.js'
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
  return traitBreakpoints(trait).map(b => ({
    min: b.minUnits,
    style: typeof b.style === 'number' ? STYLE_TIER[b.style] : null,
  }))
}

function activeTier(breakpoints, count) {
  let tier = null
  for (const b of breakpoints) {
    if (count >= b.min) tier = b.style || 'active'
    else break
  }
  return tier
}

// `onHover(traitId | null)`: the board lights up the trait's units.
function TraitRow({ row, meta, allChampions, onHover }) {
  const { triggerProps, cardProps } = useHoverCard({ meta, count: row.count })
  return (
    <>
      <li
        className={[
          styles.trait,
          row.tier ? styles[`tier_${row.tier}`] : styles.tierInactive,
          row.count === 0 ? styles.previewRow : '',
        ].filter(Boolean).join(' ')}
        {...triggerProps}
        onMouseEnter={(e) => {
          triggerProps.onMouseEnter?.(e)
          onHover?.(row.id)
        }}
        onMouseLeave={(e) => {
          triggerProps.onMouseLeave?.(e)
          onHover?.(null)
        }}
      >
        <div className={styles.iconHex} aria-hidden="true">
          {row.iconUrl && (
            <img src={row.iconUrl} alt="" className={styles.iconImg} draggable={false} />
          )}
          <span className={styles.iconCount}>{row.count}</span>
        </div>
        <div className={styles.info}>
          <span className={styles.traitName}>
            {row.name}
            {row.added > 0 && <span className={styles.added}>+{row.added}</span>}
          </span>
          {row.breakpoints.length > 0 && (
            <span className={styles.breakpoints}>
              {row.breakpoints.map((b, i) => (
                <span
                  key={b.min}
                  className={[
                    styles.bp,
                    row.count >= b.min ? styles.bpHit : '',
                    row.count < b.min && row.count + row.added >= b.min ? styles.bpPreview : '',
                  ].filter(Boolean).join(' ')}
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

// `preview` ({ trait: count }) marks what a hovered roster unit would add:
// "+1" on its traits, which show even before they're on the board.
export default function TraitList({ activeTraits, preview, onHoverTrait }) {
  const { t } = useTranslation()
  const { data: traitMeta } = useTraits()
  const { data: allChampions } = useChampions()
  const metaByName = new Map((traitMeta || []).map(t => [t.name, t]))

  const traitIds = new Set([
    ...Object.keys(activeTraits || {}).filter(id => activeTraits[id] > 0),
    ...Object.keys(preview || {}),
  ])
  const rows = [...traitIds]
    .map(traitId => {
      const count = activeTraits?.[traitId] || 0
      const meta = metaByName.get(traitId)
      const breakpoints = resolveBreakpoints(meta)
      return {
        id: traitId,
        name: meta?.name || traitId,
        iconUrl: meta?.iconUrl,
        count,
        added: preview?.[traitId] || 0,
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
              onHover={onHoverTrait}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
