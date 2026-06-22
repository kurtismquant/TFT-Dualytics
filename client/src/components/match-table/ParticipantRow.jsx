import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DamageIcon, TraitChips, UnitsGrid } from './BoardDisplay.jsx'
import PlacementBadge from '../ui/PlacementBadge.jsx'
import {
  calcBoardCost,
  formatRankDetail,
  formatRankShort,
  formatRound,
  getPlacementClass,
  getRankIconUrl,
  resolveUnits,
} from './formatters.js'
import styles from '../MatchTable.module.css'

export default function ParticipantRow({ participant, champions, items, traits, excludeTraitIds, participantRanks, ownPuuids, region }) {
  const { t } = useTranslation()
  const resolvedUnits = resolveUnits(participant.units, champions, items)
  const allItems = items
  const boardCost = calcBoardCost(participant.units, champions)
  const placementClass = getPlacementClass(styles, participant.teamPlacement)
  const placementLabel = t(`placement.${participant.teamPlacement}`, { defaultValue: String(participant.teamPlacement || '') })
  const rankInfo = participantRanks?.[participant.puuid] || null
  const rankText = formatRankShort(rankInfo)
  const rankDetail = formatRankDetail(rankInfo)
  const rankIconUrl = rankInfo ? getRankIconUrl(rankInfo.tier) : null
  const isSelf = !!(participant.puuid && ownPuuids?.has(participant.puuid))
  const canLink = !isSelf && region && participant.gameName && participant.tagLine
  const nameContent = (
    <>
      {participant.gameName || '???'}
      {participant.tagLine
        ? <span className={styles.splitTag}>#{participant.tagLine}</span>
        : null}
    </>
  )

  return (
    <div className={`${styles.participantRow} ${placementClass}`}>
      <div className={styles.participantMeta}>
        <PlacementBadge size="sm" placement={participant.teamPlacement} label={placementLabel} />
        {participant.level != null && (
          <span className={styles.levelBadge}>Lv {participant.level}</span>
        )}
        {canLink ? (
          <Link
            to={`/summoner/${region}/${encodeURIComponent(participant.gameName)}/${encodeURIComponent(participant.tagLine)}`}
            className={`${styles.participantName} ${styles.participantNameLink}`}
            onClick={e => e.stopPropagation()}
          >
            {nameContent}
          </Link>
        ) : (
          <span className={styles.participantName}>{nameContent}</span>
        )}
        {rankIconUrl && <img src={rankIconUrl} alt={rankInfo.tier} className={styles.participantRankIcon} />}
        {rankInfo?.tier && (
          <span className={styles.participantRank}>
            {/* Desktop: full text. Mobile: icon + division (non-apex) + LP. */}
            <img src={rankIconUrl} alt="" aria-hidden="true" className={styles.participantRankBoxIcon} />
            <span className={styles.participantRankText}>{rankText}</span>
            <span className={styles.participantRankDetail}>{rankDetail}</span>
          </span>
        )}
        {participant.totalDamageToPlayers != null && (
          <span className={styles.stat} title="Damage to players">
            <DamageIcon />
            {participant.totalDamageToPlayers}
          </span>
        )}
        {participant.lastRound != null && (
          <span className={styles.round} title="Last round">{formatRound(participant.lastRound)}</span>
        )}
        {boardCost > 0 && (
          <span className={styles.boardCost} title="Total board cost">{boardCost}g</span>
        )}
      </div>
      <div className={styles.participantBoard}>
        <div className={styles.participantTraits}>
          <TraitChips traitData={participant.traits} traits={traits} filterOne={false} excludeTraitIds={excludeTraitIds} allChampions={champions} />
        </div>
        <div className={styles.participantUnits}>
          <UnitsGrid resolvedUnits={resolvedUnits} allItems={allItems} />
        </div>
      </div>
    </div>
  )
}
