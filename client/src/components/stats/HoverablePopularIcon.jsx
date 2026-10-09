import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ItemCard from '../ItemCard.jsx'
import UnitCard from '../UnitCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import styles from '../../pages/StatsPage.module.css'
import linkStyles from './UnitLink.module.css'
import { buildItemPath, buildUnitPath } from '../../constants/routes.js'

const CARDS = {
  items: ItemCard,
  units: UnitCard,
}

export default function HoverablePopularIcon({ entry, meta, cardType, allItems, patch }) {
  const { t } = useTranslation()
  const isUnit = cardType === 'units'
  // Icons link to the unit / item page: tap navigates, long-press opens the sheet.
  const { triggerProps, cardProps } = useHoverCard(meta, { touchTrigger: 'longpress' })
  const Card = CARDS[cardType]
  if (!meta?.iconUrl) return null

  const name = meta.name || entry.id
  const icon = (
    <img
      className={styles.smallIcon}
      src={meta.iconUrl}
      alt={name}
      title={`${name}: ${entry.count.toLocaleString()}`}
      loading="lazy"
    />
  )

  return (
    <>
      <Link
        to={isUnit ? buildUnitPath(entry.id, patch) : buildItemPath(entry.id, patch)}
        className={`${linkStyles.link} ${linkStyles.iconLink}`}
        aria-label={isUnit ? t('unit.viewStats', { unit: name }) : t('item.viewStats', { item: name })}
        {...triggerProps}
      >
        {icon}
      </Link>
      {cardProps.isOpen && createPortal(
        <Card {...cardProps} allItems={allItems} />,
        document.body
      )}
    </>
  )
}
