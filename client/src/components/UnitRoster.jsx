import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import DraggableUnit from './DraggableUnit.jsx'
import UnitCard from './UnitCard.jsx'
import styles from './UnitRoster.module.css'
import { useBoardStore } from '../store/boardStore'
import { useHoverCard } from '../hooks/useHoverCard.js'

function RosterUnit({ champion, onPlace }) {
  // Long-press for the detail sheet on touch (tap already places the unit).
  const { triggerProps, cardProps } = useHoverCard(champion, { touchTrigger: 'longpress' })
  return (
    <>
      <div {...triggerProps}>
        <DraggableUnit
          id={`roster-${champion.id}`}
          champion={champion}
          size={56}
          staticDuringDrag
          onClick={onPlace}
        />
      </div>
      {cardProps.isOpen && createPortal(
        <UnitCard {...cardProps} />,
        document.body
      )}
    </>
  )
}



function sortChampions(champions, mode) {
  const copy = [...champions]
  switch (mode) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'origin':
      return copy.sort((a, b) => {
        const ao = a.traits?.[0] || ''
        const bo = b.traits?.[0] || ''
        return ao.localeCompare(bo) || a.name.localeCompare(b.name)
      })
    case 'class':
      return copy.sort((a, b) => {
        const ac = a.traits?.[a.traits.length - 1] || ''
        const bc = b.traits?.[b.traits.length - 1] || ''
        return ac.localeCompare(bc) || a.name.localeCompare(b.name)
      })
    case 'cost':
    default:
      return copy.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  }
}

export default function UnitRoster({ champions, search = '', sortMode = 'cost', layout = 'vertical' }) {
  const { t } = useTranslation()
  const placeInFirstAvailableHex = useBoardStore(s => s.placeInFirstAvailableHex)
  const normalizedSearch = search.trim().toLowerCase()

  // Define the valid costs we want to show
  const validCosts = [1, 2, 3, 4, 5]

  const visible = sortChampions(
    (champions || []).filter(c => {
      // 1. Cost must be 1-5
      const hasValidCost = validCosts.includes(c.cost)
      
      // 2. Explicitly exclude "Mini Black Hole" (case-insensitive)
      const isBlackHole = c.name.toLowerCase().includes('mini black hole')
      
      // 3. Search query matches name OR any trait (origin/class)
      const matchesSearch =
        !normalizedSearch ||
        c.name.toLowerCase().includes(normalizedSearch) ||
        (c.traits || []).some(t => t.toLowerCase().includes(normalizedSearch))

      return hasValidCost && !isBlackHole && matchesSearch
    }),
    sortMode,
  )

  const rootClass = layout === 'horizontal' ? `${styles.roster} ${styles.horizontal}` : styles.roster

  return (
    <div className={rootClass}>
      {visible.length === 0 ? (
        <p className={styles.empty} role="status">{t('unitRoster.empty')}</p>
      ) : (
        <div className={styles.grid}>
          {visible.map(champ => (
            <RosterUnit
              key={champ.id}
              champion={champ}
              onPlace={() => placeInFirstAvailableHex(champ.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
