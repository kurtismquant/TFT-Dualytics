import { useRef } from 'react'
import { createPortal } from 'react-dom'
import ItemCard from '../ItemCard.jsx'
import TraitCard from '../TraitCard.jsx'
import UnitCard from '../UnitCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import styles from '../../pages/StatsPage.module.css'
import StatsRowIcon from './StatsRowIcon.jsx'

const CARDS = {
  units: UnitCard,
  items: ItemCard,
  traits: TraitCard,
}

export default function HoverableNameCell({ type, row, allItems, allChampions }) {
  const hoverData = type === 'traits'
    ? { meta: row.meta, count: row.tierMin ?? Math.round(row.avgUnits || 0) }
    : row.meta
  // Anchor the card to the icon, not the full-width cell, so it opens next to it.
  const anchorRef = useRef(null)
  const { triggerProps, cardProps } = useHoverCard(hoverData, { anchorRef })
  const Card = CARDS[type]

  return (
    <>
      <div className={styles.nameCell} {...triggerProps}>
        <span ref={anchorRef} className={styles.nameAnchor}>
          <StatsRowIcon type={type} meta={row.meta} tierStyle={row.tierStyle} />
        </span>
        <span>{row.name}</span>
      </div>
      {cardProps.isOpen && createPortal(
        <Card {...cardProps} allItems={allItems} allChampions={allChampions} />,
        document.body
      )}
    </>
  )
}
