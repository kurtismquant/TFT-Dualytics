import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UnitIcon from '../UnitIcon.jsx'
import styles from './BronzeComps.module.css'

// "+N" badge in a unit's corner: units that could take its place without
// changing the result. Mouse hover, or a click / tap / Enter (toggles), opens
// a small card listing them at full size; Escape or leaving closes it. Hover
// is mouse-only: a tap's emulated hover would open the card just before the
// click toggled it shut.
export default function SwapBadge({ alternatives }) {
  const { t } = useTranslation()
  const cardId = useId()
  const [open, setOpen] = useState(false)
  const names = alternatives.map(unit => unit.name).join(', ')
  return (
    <span
      className={styles.swapWrap}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false) }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    >
      <button
        type="button"
        className={styles.altBadge}
        aria-expanded={open}
        aria-controls={cardId}
        aria-label={t('bronze.swapIn', { units: names })}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}
      >
        +{alternatives.length}
      </button>
      {open && (
        <span id={cardId} className={styles.swapCard} role="tooltip">
          <span className={styles.swapCardTitle}>{t('bronze.swapTitle')}</span>
          {alternatives.map(unit => (
            <span key={unit.id} className={styles.swapCardUnit}>
              <UnitIcon champion={unit} size={36} />
              <span className={styles.swapCardName}>{unit.name}</span>
              <span className={styles.swapCardCost}>{unit.cost}g</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
