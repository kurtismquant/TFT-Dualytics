import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MatchCard from './match-table/MatchCard.jsx'
import styles from './MatchTable.module.css'

function MatchSection({ matches, label, splitView, summonerName, summonerTag, participantRanks, isTwoPlayer, champions, items, traits, ownPuuids, region }) {
  const sortedMatches = useMemo(
    () => matches.slice().sort((a, b) => b.date - a.date),
    [matches]
  )
  return (
    <div className={styles.section}>
      {isTwoPlayer && <h3 className={styles.sectionTitle}>{label}</h3>}
      <div className={styles.cardList} role="list" aria-label={label}>
        {sortedMatches.map(match => (
          <MatchCard
            key={match.matchId}
            match={match}
            champions={champions}
            items={items}
            traits={traits}
            showPartnerBadge={isTwoPlayer}
            splitView={splitView}
            summonerName={summonerName}
            summonerTag={summonerTag}
            participantRanks={participantRanks}
            ownPuuids={ownPuuids}
            region={region}
          />
        ))}
      </div>
    </div>
  )
}

export default function MatchTable({ summonerData, summoner2Data, champions, items, traits, selectedTeammate1, selectedTeammate2 }) {
  const { t } = useTranslation()
  const { region } = useParams()
  const matches1 = summonerData?.matches || []
  const matches2 = summoner2Data?.matches || []
  const isTwoPlayer = !!summoner2Data
  const riotId = (s) => s?.summoner?.gameName
    ? `${s.summoner.gameName}#${s.summoner.tagLine}`
    : null
  const summonerName1 = summonerData?.summoner?.gameName || t('matchHistory.summoner1')
  const summonerTag1 = summonerData?.summoner?.tagLine || ''
  const summonerName2 = summoner2Data?.summoner?.gameName || t('matchHistory.summoner2')
  const summonerTag2 = summoner2Data?.summoner?.tagLine || ''
  const summonerLabel1 = riotId(summonerData) || t('matchHistory.summoner1')
  const summonerLabel2 = riotId(summoner2Data) || t('matchHistory.summoner2')
  const participantRanks1 = summonerData?.participantRanks || {}
  const participantRanks2 = summoner2Data?.participantRanks || {}
  const puuid1 = summonerData?.summoner?.puuid
  const puuid2 = summoner2Data?.summoner?.puuid
  const ownPuuids = useMemo(
    () => new Set([puuid1, puuid2].filter(Boolean)),
    [puuid1, puuid2]
  )

  if (matches1.length === 0 && matches2.length === 0) {
    return <p className={styles.empty} role="status">{t('matchHistory.noMatches')}</p>
  }

  return (
    <div className={styles.container}>
      <MatchSection
        matches={matches1}
        label={summonerLabel1}
        splitView={!!selectedTeammate1}
        summonerName={summonerName1}
        summonerTag={summonerTag1}
        participantRanks={participantRanks1}
        isTwoPlayer={isTwoPlayer}
        champions={champions}
        items={items}
        traits={traits}
        ownPuuids={ownPuuids}
        region={region}
      />
      {isTwoPlayer && (
        <MatchSection
          matches={matches2}
          label={summonerLabel2}
          splitView={!!selectedTeammate2}
          summonerName={summonerName2}
          summonerTag={summonerTag2}
          participantRanks={participantRanks2}
          isTwoPlayer={isTwoPlayer}
          champions={champions}
          items={items}
          traits={traits}
          ownPuuids={ownPuuids}
          region={region}
        />
      )}
    </div>
  )
}
