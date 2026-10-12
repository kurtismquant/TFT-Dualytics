import { useTranslation } from 'react-i18next'
import ItemIcon from '../ItemIcon.jsx'
import CopyTeamCodeButton from '../shared/CopyTeamCodeButton.jsx'
import { HoverableTraitChip, HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import { CURRENT_SET } from '../../constants/game.js'
import { activeTraitStyle } from '../../utils/bronzeComps.js'
import { CHIP_STYLE_BY_EFFECT_STYLE } from '../../utils/traitTier.js'
import { encodeTeamPlannerCode } from '../../utils/teamPlannerCode.js'
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

// One result, kept to a single line of units where the width allows: the units
// (priciest of each interchangeable group, swap-ins noted) and the emblems in
// use; the traits (counted, then other active ones, then ones a unit or emblem
// short in grey as have/need); then a button copying the Team Planner code.
// The trait count is the heading of the group the row sits in.
// `played` ({ count, avgPlacement }) marks a highly played comp with a gold star.
export default function BronzeCompRow({ comp, traitByName, traits, champions, championsById, emblemByTrait, played }) {
  const { t } = useTranslation()
  const teamCode = encodeTeamPlannerCode(comp.units.map(unit => unit.champion), championsById, CURRENT_SET)
  // style null + countLabel: an inactive (colorless) chip, used for near traits.
  const chip = (name, count, { style = activeTraitStyle(traitByName.get(name), count), countLabel } = {}) => {
    const meta = traitByName.get(name)
    if (!meta || (style == null && !countLabel)) return null
    return (
      <HoverableTraitChip
        key={name}
        trait={{ id: meta.id, numUnits: count, style: CHIP_STYLE_BY_EFFECT_STYLE[style] ?? null }}
        traits={traits}
        allChampions={champions}
        countLabel={countLabel}
      />
    )
  }
  const emblems = comp.usedEmblemTraits.map(trait => emblemByTrait.get(trait)).filter(Boolean)

  const playedLabel = played && t('bronze.highlyPlayedTitle', { count: played.count, avg: played.avgPlacement?.toFixed(2) })
  return (
    <li className={styles.row}>
      {played && (
        <span className={styles.playedStar} title={playedLabel}>
          <span aria-hidden="true">★</span>
          <span className="sr-only">{playedLabel}</span>
        </span>
      )}
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
                <ItemIcon item={item} size={28} />
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
        {comp.nearTraits.length > 0 && (
          <span className={styles.nearTraits} title={t('bronze.nearTitle')}>
            {comp.nearTraits.map(trait => chip(trait.name, trait.count, { style: null, countLabel: `${trait.count}/${trait.needed}` }))}
          </span>
        )}
      </div>
      <CopyTeamCodeButton code={teamCode} className={styles.copyCell} />
    </li>
  )
}
