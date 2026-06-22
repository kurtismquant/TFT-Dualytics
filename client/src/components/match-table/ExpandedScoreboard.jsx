import ParticipantRow from './ParticipantRow.jsx'
import styles from '../MatchTable.module.css'

export default function ExpandedScoreboard({ match, champions, items, traits, excludeTraitIds, participantRanks, ownPuuids, region, id, labelledBy }) {
  const participants = match.allParticipants
  if (!participants?.length) {
    return <div className={styles.expandedEmpty} id={id} role="status">Full scoreboard not available - restart the server to fetch new match data.</div>
  }

  return (
    <div className={styles.expandedBody} id={id} role="region" aria-labelledby={labelledBy}>
      <div role="list">
        {participants.map((p, i) => {
          const showDivider = i > 0 && p.teamPlacement !== participants[i - 1].teamPlacement
          return (
            <div key={p.puuid || i} role="listitem">
              {showDivider && <div className={styles.teamDivider} aria-hidden="true" />}
              <ParticipantRow
                participant={p}
                champions={champions}
                items={items}
                traits={traits}
                excludeTraitIds={excludeTraitIds}
                participantRanks={participantRanks}
                ownPuuids={ownPuuids}
                region={region}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
