import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ItemCard from '../ItemCard.jsx'
import TraitCard from '../TraitCard.jsx'
import UnitCard from '../UnitCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import styles from '../../pages/StatsPage.module.css'
import StatsRowIcon from './StatsRowIcon.jsx'
import linkStyles from './UnitLink.module.css'
import { buildUnitPath } from '../../constants/routes.js'

const CARDS = {
  units: UnitCard,
  items: ItemCard,
  traits: TraitCard,
}

export default function HoverableNameCell({ type, row, allItems, allChampions, patch }) {
  const { t } = useTranslation()
  const isUnit = type === 'units'
  const hoverData = type === 'traits'
    ? { meta: row.meta, count: row.tierMin ?? Math.round(row.avgUnits || 0) }
    : row.meta
  // Anchor the card to the icon, not the full-width cell, so it opens next to it.
  const anchorRef = useRef(null)
  // Unit cells link to the unit page, so on touch a tap navigates and a
  // long-press opens the detail sheet instead.
  const { triggerProps, cardProps } = useHoverCard(hoverData, {
    anchorRef,
    touchTrigger: isUnit ? 'longpress' : 'tap',
  })
  const Card = CARDS[type]
  const content = (
    <>
      <span ref={anchorRef} className={styles.nameAnchor}>
        <StatsRowIcon type={type} meta={row.meta} tierStyle={row.tierStyle} />
      </span>
      <span>{row.name}</span>
    </>
  )

  return (
    <>
      {isUnit ? (
        <Link
          to={buildUnitPath(row.id, patch)}
          className={`${styles.nameCell} ${linkStyles.link}`}
          aria-label={t('unit.viewStats', { unit: row.name })}
          {...triggerProps}
        >
          {content}
        </Link>
      ) : (
        <div className={styles.nameCell} {...triggerProps}>{content}</div>
      )}
      {cardProps.isOpen && createPortal(
        <Card {...cardProps} allItems={allItems} allChampions={allChampions} />,
        document.body
      )}
    </>
  )
}
