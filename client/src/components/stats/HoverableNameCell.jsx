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
  const { onMouseEnter, onMouseLeave, cardProps } = useHoverCard(hoverData)
  const Card = CARDS[type]

  return (
    <>
      <div className={styles.nameCell} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <StatsRowIcon type={type} meta={row.meta} tierStyle={row.tierStyle} />
        <span>{row.name}</span>
      </div>
      {cardProps.isOpen && createPortal(
        <Card {...cardProps} allItems={allItems} allChampions={allChampions} />,
        document.body
      )}
    </>
  )
}
