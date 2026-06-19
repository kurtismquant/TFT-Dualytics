import { createPortal } from 'react-dom'
import ItemCard from '../ItemCard.jsx'
import UnitCard from '../UnitCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import styles from '../../pages/StatsPage.module.css'

const CARDS = {
  items: ItemCard,
  units: UnitCard,
}

export default function HoverablePopularIcon({ entry, meta, cardType, allItems }) {
  const { triggerProps, cardProps } = useHoverCard(meta)
  const Card = CARDS[cardType]
  if (!meta?.iconUrl) return null

  return (
    <>
      <img
        className={styles.smallIcon}
        src={meta.iconUrl}
        alt={meta.name || entry.id}
        title={`${meta.name || entry.id}: ${entry.count.toLocaleString()}`}
        loading="lazy"
        {...triggerProps}
      />
      {cardProps.isOpen && createPortal(
        <Card {...cardProps} allItems={allItems} />,
        document.body
      )}
    </>
  )
}
