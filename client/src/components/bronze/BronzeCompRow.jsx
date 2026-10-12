import { useTranslation } from 'react-i18next'
import ItemIcon from '../ItemIcon.jsx'
import { HoverableTraitChip, HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import { activeTraitStyle } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

// Kha'Zix's chosen evolutions as small trait icons under his portrait.
function ChosenTraits({ chosen, traitByName, bonus }) {
  const { t } = useTranslation()
  const label = t(bonus ? 'bronze.bonusEvolution' : 'bronze.evolutions', { traits: chosen.join(', ') })
  return (
    <span className={styles.chosenTraits} title={label}>
      {chosen.map(name => (
        <img key={name} src={traitByName.get(name)?.iconUrl} alt="" className={styles.chosenTraitIcon} aria-hidden="true" />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  )
}

// One result: counted-trait total, the units (priciest of each interchangeable
// group, swap-ins noted), the emblems in use, then the counted traits and any
// other active traits.
export default function BronzeCompRow({ comp, rank, traitByName, traits, champions, emblemByTrait }) {
  const { t } = useTranslation()
  const chip = (name, count) => {
    const meta = traitByName.get(name)
    const style = activeTraitStyle(meta, count)
    if (!meta || style == null) return null
    return (
      <HoverableTraitChip
        key={name}
        trait={{ id: meta.id, numUnits: count, style }}
        traits={traits}
        allChampions={champions}
      />
    )
  }
  const emblems = comp.usedEmblemTraits.map(trait => emblemByTrait.get(trait)).filter(Boolean)

  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.rank}>#{rank}</span>
        <span className={styles.score}>
          <span className={styles.scoreValue}>{comp.traitCount}</span>
          <span className={styles.scoreLabel}>{t('bronze.traitsLabel', { count: comp.traitCount })}</span>
        </span>
      </div>
      <div className={styles.board}>
        <ul className={styles.units} aria-label={t('bronze.unitsLabel')}>
          {comp.units.map(({ champion, alternatives, required }) => {
            const swapIns = alternatives.map(alt => alt.name).join(', ')
            return (
              <li key={champion.id} className={`${styles.unit} ${required ? styles.requiredUnit : ''}`}>
                <HoverableUnit unit={{ champion }} href={buildUnitPath(champion.id)} />
                <span className={styles.unitName}>{champion.name}</span>
                {champion.chosenTraits && (
                  <ChosenTraits chosen={champion.chosenTraits} traitByName={traitByName} bonus={comp.bonusEvolution} />
                )}
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
        {emblems.length > 0 && (
          <ul className={styles.emblems} aria-label={t('bronze.emblemsUsed')}>
            {emblems.map((item, index) => (
              <li key={`${item.id}-${index}`} title={item.name}>
                <ItemIcon item={item} size={30} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.traits}>
        {comp.countedTraits.map(trait => chip(trait.name, trait.count))}
        {comp.otherTraits.length > 0 && (
          <span className={styles.otherTraits}>
            {comp.otherTraits.map(trait => chip(trait.name, trait.count))}
          </span>
        )}
      </div>
    </li>
  )
}
