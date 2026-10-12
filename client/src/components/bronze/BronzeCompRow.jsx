import { useTranslation } from 'react-i18next'
import { HoverableTraitChip, HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import { activeTraitStyle } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

const BRONZE_STYLE = 1

// One result: bronze count, the units (cheapest of each interchangeable group,
// with the swap-ins noted), its bronze traits, then any other active traits.
export default function BronzeCompRow({ comp, rank, traitByName, traits, champions }) {
  const { t } = useTranslation()
  const chip = (name, count, style) => {
    const meta = traitByName.get(name)
    if (!meta) return null
    return (
      <HoverableTraitChip
        key={name}
        trait={{ id: meta.id, numUnits: count, style }}
        traits={traits}
        allChampions={champions}
      />
    )
  }
  const otherActive = comp.otherTraits
    .map(trait => ({ ...trait, style: activeTraitStyle(traitByName.get(trait.name), trait.count) }))
    .filter(trait => trait.style != null)

  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.rank}>#{rank}</span>
        <span className={styles.score}>
          <span className={styles.scoreValue}>{comp.bronzeCount}</span>
          <span className={styles.scoreLabel}>{t('bronze.bronzeLabel')}</span>
        </span>
        <span className={styles.cost}>{t('bronze.gold', { count: comp.totalCost })}</span>
      </div>
      <ul className={styles.units} aria-label={t('bronze.unitsLabel')}>
        {comp.units.map(({ champion, alternatives }) => {
          const swapIns = alternatives.map(alt => alt.name).join(', ')
          return (
            <li key={champion.id} className={styles.unit}>
              <HoverableUnit unit={{ champion }} href={buildUnitPath(champion.id)} />
              <span className={styles.unitName}>{champion.name}</span>
              {alternatives.length > 0 && (
                <span className={styles.altBadge} title={t('bronze.swapIn', { units: swapIns })}>
                  <span aria-hidden="true">+{alternatives.length}</span>
                  <span className="sr-only">{t('bronze.swapIn', { units: swapIns })}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <div className={styles.traits}>
        {comp.bronzeTraits.map(trait => chip(trait.name, trait.count, BRONZE_STYLE))}
        {otherActive.length > 0 && (
          <span className={styles.otherTraits}>
            {otherActive.map(trait => chip(trait.name, trait.count, trait.style))}
          </span>
        )}
      </div>
    </li>
  )
}
