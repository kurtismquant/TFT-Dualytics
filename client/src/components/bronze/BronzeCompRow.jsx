import { useTranslation } from 'react-i18next'
import ItemIcon from '../ItemIcon.jsx'
import UnitIcon from '../UnitIcon.jsx'
import CopyTeamCodeButton from '../shared/CopyTeamCodeButton.jsx'
import SwapBadge from './SwapBadge.jsx'
import { PlayCount, PlayedStar } from './PlayedMarks.jsx'
import { HoverableTraitChip, HoverableUnit } from '../shared/HoverableBoardPieces.jsx'
import { buildUnitPath } from '../../constants/routes.js'
import { CURRENT_SET } from '../../constants/game.js'
import { activeTraitStyle } from '../../utils/bronzeComps.js'
import { CHIP_STYLE_BY_EFFECT_STYLE } from '../../utils/traitTier.js'
import { encodeTeamPlannerCode, TEAM_PLANNER_SLOTS } from '../../utils/teamPlannerCode.js'
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

// My-board mode: what to buy and which of the player's units to sell to get
// from their board to this one.
// Ends with the board's score, its breakdown on hover.
function FromBoard({ comp, weights }) {
  const { t } = useTranslation()
  const { buy, sell, score, sharedCount, ownedTraitCount, penalty } = comp.fromBoard
  const breakdown = t('bronze.scoreBreakdown', {
    traits: comp.traitCount, traitWeight: weights.trait, kept: sharedCount, total: ownedTraitCount,
    keptWeight: weights.sharedTrait, penalty,
  })
  const scoreBadge = (
    <span className={styles.boardScore} title={breakdown}>
      {t('bronze.scoreLabel', { score: Number(score.toFixed(2)) })}
      <span className="sr-only"> ({breakdown})</span>
    </span>
  )
  if (buy.length === 0 && sell.length === 0) {
    return (
      <p className={styles.fromBoard}>
        <span className={styles.fromBoardReady}>{t('bronze.fromBoardReady')}</span>
        {scoreBadge}
      </p>
    )
  }
  const icons = (units, sold) => units.map(champion => (
    <span key={champion.id} className={sold ? styles.fromBoardSold : undefined} title={champion.name}>
      <UnitIcon champion={champion} size={20} />
    </span>
  ))
  return (
    <p className={styles.fromBoard}>
      {buy.length > 0 && (
        <span className={styles.fromBoardPart}>
          <span className={styles.fromBoardLabel}>{t('bronze.fromBoardBuy', { count: buy.length })}</span>
          {icons(buy, false)}
        </span>
      )}
      {sell.length > 0 && (
        <span className={styles.fromBoardPart}>
          <span className={styles.fromBoardLabel}>{t('bronze.fromBoardSell', { count: sell.length })}</span>
          {icons(sell, true)}
        </span>
      )}
      <span className="sr-only">
        {t('bronze.fromBoardSummary', { buy: buy.map(c => c.name).join(', ') || '-', sell: sell.map(c => c.name).join(', ') || '-' })}
      </span>
      {scoreBadge}
    </p>
  )
}

// A merged Lux (or other trait-form unit): one small icon per form that fits
// here, each the trait it adds; the shown traits are for the first form.
function FormOptions({ forms, traitByName }) {
  const { t } = useTranslation()
  const label = t('bronze.formOptions', { forms: forms.map(form => form.champion.name).join(', ') })
  return (
    <span className={styles.chosenTraits} title={label}>
      {forms.map(({ champion, trait }) => (
        <img key={champion.id} src={traitByName.get(trait)?.iconUrl} alt="" className={styles.chosenTraitIcon} aria-hidden="true" />
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
// `played` ({ count, avgPlacement }) marks a highly played comp with a gold
// star; `plays` (the same, any count) adds a line with it under the units.
export default function BronzeCompRow({
  comp, traitByName, traits, champions, championsById, emblemByTrait, toolItems = {}, boardWeights, played, plays,
}) {
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
  // Emblems to make with the Spatula / Frying Pan held, before the owned ones.
  const crafted = (comp.craftedEmblems || [])
    .map(({ tool, trait }) => ({ tool, item: emblemByTrait.get(trait) }))
    .filter(entry => entry.item)

  return (
    <li className={styles.row}>
      {played && <PlayedStar played={played} />}
      <div className={styles.board}>
        <ul className={styles.units} aria-label={t('bronze.unitsLabel')}>
          {comp.units.map(({ champion, alternatives, required, owned }) => {
            // Merged Lux forms: named as the base unit, with the forms that fit.
            const forms = comp.formOptions?.find(option => option.formOf === champion.formOf)?.forms
            const merged = forms?.length > 1
            return (
              <li key={champion.id} className={`${styles.unit} ${required || owned ? styles.requiredUnit : ''}`}>
                <HoverableUnit unit={{ champion }} href={buildUnitPath(champion.id)} />
                <span className={styles.unitName}>{merged ? championsById?.get(champion.formOf)?.name || champion.name : champion.name}</span>
                {merged && <FormOptions forms={forms} traitByName={traitByName} />}
                {champion.chosenTraits?.length > 0 && (
                  <ChosenTraits chosen={champion.chosenTraits} traitByName={traitByName} bonus={comp.bonusEvolution} />
                )}
                {alternatives.length > 0 && <SwapBadge alternatives={alternatives} />}
              </li>
            )
          })}
        </ul>
        {comp.fromBoard && boardWeights && <FromBoard comp={comp} weights={boardWeights} />}
        {plays && <PlayCount plays={plays} />}
        {(crafted.length > 0 || emblems.length > 0) && (
          <ul className={styles.emblems} aria-label={t('bronze.emblemsUsed')}>
            {crafted.map(({ tool, item }) => {
              const label = t('bronze.craftTitle', { tool: t(`bronze.tool_${tool}`), emblem: item.name })
              return (
                <li key={`craft-${tool}`} className={styles.craftedEmblem} title={label}>
                  <ItemIcon item={item} size={28} />
                  <span className={styles.craftBadge} aria-hidden="true"><ItemIcon item={toolItems[tool]} size={14} /></span>
                  <span className="sr-only">{label}</span>
                </li>
              )
            })}
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
      <CopyTeamCodeButton
        code={teamCode}
        className={styles.copyCell}
        // The in-game planner holds 10 units; bigger boards drop the cheapest.
        note={comp.units.length > TEAM_PLANNER_SLOTS ? t('teamCode.tooManyUnits', { count: TEAM_PLANNER_SLOTS }) : null}
      />
    </li>
  )
}
