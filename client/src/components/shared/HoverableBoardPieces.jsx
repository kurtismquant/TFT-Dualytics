import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UnitIcon from '../UnitIcon.jsx'
import ItemIcon from '../ItemIcon.jsx'
import UnitCard from '../UnitCard.jsx'
import TraitCard from '../TraitCard.jsx'
import ItemCard from '../ItemCard.jsx'
import { useHoverCard } from '../../hooks/useHoverCard.js'
import chipStyles from '../ui/TraitChip.module.css'
import pieceStyles from './HoverableBoardPieces.module.css'
import { buildItemPath, buildUnitPath } from '../../constants/routes.js'

// With `href`, the unit is a link to its stats page. Touch devices then open the
// detail sheet on long-press instead of tap, since a tap now navigates.
export function HoverableUnit({ unit, floatStars, href }) {
  const { t } = useTranslation()
  const { triggerProps, cardProps } = useHoverCard(unit.champion, { touchTrigger: href ? 'longpress' : 'tap' })
  const icon = <UnitIcon champion={unit.champion} size={44} tier={unit.tier} floatStars={floatStars} />
  return (
    <>
      {href ? (
        <Link
          to={href}
          className={pieceStyles.unitLink}
          aria-label={t('unit.viewStats', { unit: unit.champion?.name })}
          {...triggerProps}
        >
          {icon}
        </Link>
      ) : (
        <div {...triggerProps}>{icon}</div>
      )}
      {cardProps.isOpen && createPortal(<UnitCard {...cardProps} />, document.body)}
    </>
  )
}

// Links to the item's stats page; `href` overrides the target (e.g. to pin a
// patch). Touch devices open the detail sheet on long-press, since a tap navigates.
// Callers must not render this inside a <button> or another link.
export function HoverableItem({ item, allItems, size = 14, href }) {
  const { t } = useTranslation()
  const to = href ?? buildItemPath(item.apiName || item.id)
  const { triggerProps, cardProps } = useHoverCard(item, { touchTrigger: 'longpress' })
  const icon = <ItemIcon item={item} size={size} />
  return (
    <>
      <Link
        to={to}
        className={pieceStyles.unitLink}
        aria-label={t('item.viewStats', { item: item.name })}
        {...triggerProps}
      >
        {icon}
      </Link>
      {cardProps.isOpen && createPortal(<ItemCard {...cardProps} allItems={allItems} />, document.body)}
    </>
  )
}

export function HoverableTraitChip({ trait, traits, allChampions }) {
  const meta = traits?.find(td => td.id === trait.id) || null
  const { triggerProps, cardProps } = useHoverCard({ meta, count: trait.numUnits })
  if (!meta) return null
  const tierLabel = trait.style ? `, trait tier ${trait.style}` : ''
  const chipLabel = `${meta.name}, ${trait.numUnits} units${tierLabel}`
  return (
    <>
      <span
        className={`${chipStyles.traitChip} ${chipStyles[`style${trait.style}`] || ''}`}
        title={chipLabel}
        {...triggerProps}
      >
        <img src={meta.iconUrl} alt="" className={chipStyles.traitIcon} loading="lazy" aria-hidden="true" />
        <span className={chipStyles.traitCount} aria-hidden="true">{trait.numUnits}</span>
        <span className="sr-only">{chipLabel}</span>
      </span>
      {cardProps.isOpen && createPortal(<TraitCard {...cardProps} allChampions={allChampions} />, document.body)}
    </>
  )
}

export function TraitChips({ traitData, traits, filterOne, excludeTraitIds, allChampions, copyBeforeSort = true }) {
  const source = copyBeforeSort ? [...(traitData || [])] : (traitData || [])
  const resolved = source
    .filter(t => (!filterOne || t.numUnits > 1) && !excludeTraitIds?.has(t.id))
    .sort((a, b) => b.tierCurrent - a.tierCurrent || b.numUnits - a.numUnits)

  return resolved.map(t => (
    <HoverableTraitChip key={t.id} trait={t} traits={traits} allChampions={allChampions} />
  ))
}

// Each unit links to its stats page. `getUnitHref(unitId)` overrides the target
// (e.g. the Comps page pins the selected patch). Callers must not render this
// inside a <button> or another link.
const defaultUnitHref = unitId => buildUnitPath(unitId)

export function UnitsGrid({ resolvedUnits, allItems, styles, floatStars, getUnitHref = defaultUnitHref }) {
  return resolvedUnits.map((unit, i) => (
    <div key={i} className={styles.unitColumn}>
      <HoverableUnit unit={unit} floatStars={floatStars} href={getUnitHref(unit.id)} />
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
