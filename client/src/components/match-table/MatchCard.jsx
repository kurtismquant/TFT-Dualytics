import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DamageIcon, TraitChips, UnitsGrid } from './BoardDisplay.jsx'
import ExpandedScoreboard from './ExpandedScoreboard.jsx'
import PlacementBadge from '../ui/PlacementBadge.jsx'
import {
  formatDate,
  formatRound,
  getPlacementClass,
  getTeamPlacement,
  resolveUnits,
} from './formatters.js'
import styles from '../MatchTable.module.css'

export default function MatchCard({ match, champions, items, traits, showPartnerBadge, splitView, summonerName, summonerTag, participantRanks, ownPuuids, region }) {
  const { t } = useTranslation()
  const reactId = useId()
  const [expanded, setExpanded] = useState(false)
  const teamPlacement = getTeamPlacement(match)
  const placementClass = getPlacementClass(styles, teamPlacement)
  const dateLabel = formatDate(match.date)
  const buttonId = `${reactId}-match-summary`
  const panelId = `${reactId}-match-scoreboard`
  const placementLabel = t(`placement.${teamPlacement}`, { defaultValue: String(teamPlacement || '–') })

  const toggleLabel = t(expanded ? 'matchHistory.collapseScoreboard' : 'matchHistory.expandScoreboard', {
    placement: placementLabel,
    date: dateLabel,
  })

  const resolvedUnits = resolveUnits(match.units, champions, items)
  const resolvedPartnerUnits = resolveUnits(match.partnerUnits, champions, items)

  const isPartner = showPartnerBadge && match.wasPartnerWith

  const toggleExpand = () => setExpanded(v => !v)

  const expandedScoreboard = expanded && (
    <ExpandedScoreboard
      match={match}
      champions={champions}
      items={items}
      traits={traits}
      participantRanks={participantRanks}
      ownPuuids={ownPuuids}
      region={region}
      id={panelId}
      labelledBy={buttonId}
    />
  )

  if (splitView) {
    return (
      <div className={`${styles.card} ${isPartner ? styles.partnerCard : ''}`} role="listitem">
        <button
          type="button"
          className={styles.cardButton}
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={toggleLabel}
          id={buttonId}
        >
          <div className={`${styles.compactContent} ${placementClass}`}>
          <div className={styles.splitBody}>
            {/* Left — user */}
            <div className={styles.splitCol}>
              <div className={styles.splitNameRow}>
                <PlacementBadge placement={teamPlacement} label={placementLabel} />
                {match.level != null && <span className={styles.levelBadge}>Lv {match.level}</span>}
                <span className={styles.splitName}>
                  {summonerName}
                  {summonerTag ? <span className={styles.splitTag}>#{summonerTag}</span> : null}
                </span>
                {match.totalDamageToPlayers != null && (
                  <span className={styles.stat} title="Damage to players">
                    <DamageIcon />
                    {match.totalDamageToPlayers}
                  </span>
                )}
                {match.lastRound != null && (
                  <span className={styles.round} title="Last round">{formatRound(match.lastRound)}</span>
                )}
              </div>
              <div className={styles.splitTraits}>
                <TraitChips traitData={match.traits} traits={traits} filterOne allChampions={champions} />
              </div>
              <div className={styles.splitUnits}>
                <UnitsGrid resolvedUnits={resolvedUnits} allItems={items} />
              </div>
            </div>

            <div className={styles.splitDivider} />

            {/* Right — partner */}
            <div className={styles.splitCol}>
              <div className={styles.splitNameRow}>
                {match.partnerLevel != null && <span className={styles.levelBadge}>Lv {match.partnerLevel}</span>}
                <span className={styles.splitName}>
                  {match.partnerGameName || 'Partner'}
                  {match.partnerTagLine ? <span className={styles.splitTag}>#{match.partnerTagLine}</span> : null}
                </span>
                {match.partnerTotalDamageToPlayers != null && (
                  <span className={styles.stat} title="Damage to players">
                    <DamageIcon />
                    {match.partnerTotalDamageToPlayers}
                  </span>
                )}
                {match.partnerLastRound != null && (
                  <span className={styles.round} title="Last round">{formatRound(match.partnerLastRound)}</span>
                )}
              </div>
              <div className={styles.splitTraits}>
                <TraitChips traitData={match.partnerTraits} traits={traits} filterOne allChampions={champions} />
              </div>
              <div className={styles.splitUnits}>
                <UnitsGrid resolvedUnits={resolvedPartnerUnits} allItems={items} />
              </div>
            </div>
          </div>
          
          </div>
        </button>
        {expandedScoreboard}
      </div>
    )
  }

  // Normal view
  const resolvedTraits = (match.traits || [])
    .sort((a, b) => b.tierCurrent - a.tierCurrent || b.numUnits - a.numUnits)

  return (
    <div className={`${styles.card} ${isPartner ? styles.partnerCard : ''}`} role="listitem">
      <button
        type="button"
        className={styles.cardButton}
        onClick={toggleExpand}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={toggleLabel}
        id={buttonId}
      >
        <div className={`${styles.compactContent} ${placementClass}`}>
        <div className={styles.headerBar}>
          <div className={styles.headerLeft}>
            <span className={styles.modeLabel}>Double Up</span>
            {match.totalDamageToPlayers != null && (
              <span className={styles.stat} title="Damage to players">
                <DamageIcon />
                {match.totalDamageToPlayers}
              </span>
            )}
            {match.lastRound != null && (
              <span className={styles.round} title="Last round">{formatRound(match.lastRound)}</span>
            )}
            <span className={styles.dateLabel}>{dateLabel}</span>
            {isPartner && <span className={styles.partnerTag}>PARTNERS</span>}
          </div>
          <div className={styles.headerRight}>
            <div className={styles.traitRow}>
              <TraitChips traitData={resolvedTraits} traits={traits} filterOne={false} allChampions={champions} />
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.placementBlock}>
            <PlacementBadge placement={teamPlacement} label={placementLabel} />
            {match.level != null && (
              <span className={styles.levelBadge} title="Level">Lv {match.level}</span>
            )}
          </div>

          <div className={styles.unitsRow}>
            <UnitsGrid resolvedUnits={resolvedUnits} allItems={items} />
          </div>
        </div>
        </div>
      </button>

      {expandedScoreboard}
    </div>
  )
}
