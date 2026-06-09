import { createPortal } from 'react-dom'
import UnitIcon from '../UnitIcon.jsx'
import ItemIcon from '../ItemIcon.jsx'
import UnitCard from '../UnitCard.jsx'
import TraitCard from '../TraitCard.jsx'
import ItemCard from '../ItemCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import chipStyles from '../ui/TraitChip.module.css'

export function HoverableUnit({ unit }) {
  const { onMouseEnter, onMouseLeave, cardProps } = useHoverCard(unit.champion)
  return (
    <>
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <UnitIcon champion={unit.champion} size={44} tier={unit.tier} />
      </div>
      {cardProps.isOpen && createPortal(<UnitCard {...cardProps} />, document.body)}
    </>
  )
}

export function HoverableItem({ item, allItems }) {
  const { onMouseEnter, onMouseLeave, cardProps } = useHoverCard(item)
  return (
    <>
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <ItemIcon item={item} size={14} />
      </div>
      {cardProps.isOpen && createPortal(<ItemCard {...cardProps} allItems={allItems} />, document.body)}
    </>
  )
}

export function HoverableTraitChip({ trait, traits, allChampions }) {
  const meta = traits?.find(td => td.id === trait.id) || null
  const { onMouseEnter, onMouseLeave, cardProps } = useHoverCard({ meta, count: trait.numUnits })
  if (!meta) return null
  const tierLabel = trait.style ? `, trait tier ${trait.style}` : ''
  const chipLabel = `${meta.name}, ${trait.numUnits} units${tierLabel}`
  return (
    <>
      <span
        className={`${chipStyles.traitChip} ${chipStyles[`style${trait.style}`] || ''}`}
        title={chipLabel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <img src={meta.iconUrl} alt="" className={chipStyles.traitIcon} loading="lazy" aria-hidden="true" />
        <span className={chipStyles.traitCount} aria-hidden="true">{trait.numUnits}</span>
        <span className="sr-only">{chipLabel}</span>
      </span>
      {cardProps.isOpen && createPortal(<TraitCard {...cardProps} allChampions={allChampions} />, document.body)}
    </>
  )
}

export function TraitChips({ traitData, traits, filterOne, allChampions, copyBeforeSort = true }) {
  const source = copyBeforeSort ? [...(traitData || [])] : (traitData || [])
  const resolved = source
    .filter(t => !filterOne || t.numUnits > 1)
    .sort((a, b) => b.tierCurrent - a.tierCurrent || b.numUnits - a.numUnits)

  return resolved.map(t => (
    <HoverableTraitChip key={t.id} trait={t} traits={traits} allChampions={allChampions} />
  ))
}

export function UnitsGrid({ resolvedUnits, allItems, styles }) {
  return resolvedUnits.map((unit, i) => (
    <div key={i} className={styles.unitColumn}>
      <HoverableUnit unit={unit} />
      <div className={styles.itemRow}>
        {unit.resolvedItems.map((item, j) => (
          item
            ? <HoverableItem key={j} item={item} allItems={allItems} />
            : <span key={j} className={styles.itemSlot} />
        ))}
      </div>
    </div>
  ))
}
