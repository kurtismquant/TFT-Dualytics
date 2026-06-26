import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRefreshSummonerMatches, useSummonerMatches } from '../hooks/useSummonerMatches.js'
import { useChampions } from '../hooks/useChampions.js'
import { useItems } from '../hooks/useItems.js'
import { useTraits } from '../hooks/useTraits.js'
import { useRateLimitStats } from '../hooks/useRateLimitStats.js'
import LandingSearchBar from '../components/LandingSearchBar.jsx'
import SearchBar from '../components/SearchBar.jsx'
import MatchTable from '../components/MatchTable.jsx'
import SummonerProfileCard from '../components/SummonerProfileCard.jsx'
import SummonerStatsCard from '../components/SummonerStatsCard.jsx'
import LPGraph from '../components/LPGraph.jsx'
import TeammatesCard from '../components/TeammatesCard.jsx'
import { PageShell } from '../components/layout/PageShell.jsx'
import styles from './MatchHistoryPage.module.css'

function formatRiotId(gameName, tagLine) {
  if (!gameName || !tagLine) return ''
  return `${gameName}#${tagLine}`
}

function formatEta(seconds) {
  if (!seconds) return 'Finalizing'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes}m`
}

function getSyncStatuses(data, isTwoPlayer) {
  if (!data) return []
  return isTwoPlayer
    ? [data.summoner1?.sync, data.summoner2?.sync].filter(Boolean)
    : [data.sync].filter(Boolean)
}

function getSyncProgress(syncStatuses) {
  const syncing = syncStatuses.filter(sync => sync.state === 'syncing')
  if (!syncing.length) return null
  const eta = Math.max(...syncing.map(sync => sync.etaSeconds || 0))
  const totals = syncing.map(sync => sync.totalNewMatches).filter(total => total != null)
  const processed = syncing.reduce((sum, sync) => sum + (sync.processedNewMatches || 0), 0)

  // Once the new-match totals are known, processed/total is a real fraction (used by
  // the console progress log); before that (resolving / listing ids) only counts exist.
  if (totals.length === syncing.length) {
    const total = totals.reduce((sum, value) => sum + value, 0)
    return { phase: 'details', processed, total, eta }
  }

  const idsFound = syncing.reduce((sum, sync) => sum + (sync.matchIdsFound || 0), 0)
  return { phase: idsFound > 0 ? 'ids' : 'resolving', idsFound, eta }
}

function formatProgressLabel(t, progress) {
  if (!progress) return ''
  if (progress.phase === 'details') {
    return t('matchHistory.progressDetails', { processed: progress.processed, total: progress.total })
  }
  if (progress.phase === 'ids') return t('matchHistory.progressIds', { count: progress.idsFound })
  return t('matchHistory.progressResolving')
}

function isSameRiotId(a, b) {
  return a?.gameName === b?.gameName && a?.tagLine === b?.tagLine
}

export default function MatchHistoryPage() {
  const { t } = useTranslation()
  const { region, gameName, tagLine, gameName2, tagLine2 } = useParams()

  const id1 = gameName && tagLine ? { gameName, tagLine } : null
  const id2 = gameName2 && tagLine2 ? { gameName: gameName2, tagLine: tagLine2 } : null
  const ids = [id1, id2].filter(Boolean)
  const isTwoPlayer = !!id2

  const { data, isLoading, isError, error } = useSummonerMatches(region, ids)
  const refreshMatches = useRefreshSummonerMatches(region, ids)
  const { data: champions } = useChampions()
  const { data: items } = useItems()
  const { data: traits } = useTraits()
  const { data: rlStats } = useRateLimitStats()

  const summonerData = isTwoPlayer ? data?.summoner1 : data
  const summoner2Data = isTwoPlayer ? data?.summoner2 : null

  const [selectedTeammate1, setSelectedTeammate1] = useState(null)
  const [selectedTeammate2, setSelectedTeammate2] = useState(null)

  const filteredSummonerData = useMemo(() => {
    if (!selectedTeammate1 || !summonerData) return summonerData
    return { ...summonerData, matches: summonerData.matches.filter(m => m.partnerPuuid === selectedTeammate1) }
  }, [summonerData, selectedTeammate1])

  const filteredSummoner2Data = useMemo(() => {
    if (!selectedTeammate2 || !summoner2Data) return summoner2Data
    return { ...summoner2Data, matches: summoner2Data.matches.filter(m => m.partnerPuuid === selectedTeammate2) }
  }, [summoner2Data, selectedTeammate2])

  const loadedCount = (summonerData?.matches?.length || 0) + (summoner2Data?.matches?.length || 0)
  const hasAnyMatches = loadedCount > 0
  const syncStatuses = getSyncStatuses(data, isTwoPlayer)
  const activeSyncs = syncStatuses.filter(sync => sync.state === 'syncing')
  const syncErrors = syncStatuses.filter(sync => sync.state === 'error')
  const syncProgress = getSyncProgress(syncStatuses)
  const progressLabel = formatProgressLabel(t, syncProgress)
  const isSyncing = activeSyncs.length > 0
  // Per-player sync progress so the stats card can show "loaded/total games" while
  // matches stream in. null when that player isn't syncing; total is null until the
  // sync has finished listing the new match ids.
  const isSyncing1 = summonerData?.sync?.state === 'syncing'
  const isSyncing2 = summoner2Data?.sync?.state === 'syncing'
  const statsProgress1 = isSyncing1
    ? { loaded: summonerData.sync.processedNewMatches ?? 0, total: summonerData.sync.totalNewMatches ?? null }
    : null
  const statsProgress2 = isSyncing2
    ? { loaded: summoner2Data.sync.processedNewMatches ?? 0, total: summoner2Data.sync.totalNewMatches ?? null }
    : null
  const showCachedShell = !!data && !hasAnyMatches && isSyncing
  const syncNotFound = !hasAnyMatches && syncErrors.some(sync => sync.error === 'RIOT ID NOT FOUND')
  const isNotFound = (isError && error?.response?.status === 404) || syncNotFound
  const requestedIds = ids.map(id => formatRiotId(id.gameName, id.tagLine)).join(' / ')
  const refreshError = refreshMatches.error?.response?.data?.error || refreshMatches.error?.message
  const refreshTargetIds = refreshMatches.variables || []
  const isRefreshingPlayer = (id, sync) => (
    sync?.state === 'syncing' ||
    (refreshMatches.isPending && refreshTargetIds.some(target => isSameRiotId(target, id)))
  )
  const handleRefreshPlayer = id => {
    if (!id) return
    refreshMatches.mutate([id])
  }

  // Surface refresh progress in the browser console (the on-screen debug notice
  // was removed). Logs a line per progress update while syncing, plus a start
  // line on the first tick and a completion line when the sync finishes.
  const progressLine = isSyncing && syncProgress
    ? `Refreshing match history — ${progressLabel} / ETA ${formatEta(syncProgress.eta)}`
    : null
  const wasSyncingRef = useRef(false)
  useEffect(() => {
    if (isSyncing && !wasSyncingRef.current) {
      console.log('Refreshing match history — starting Riot sync')
    } else if (!isSyncing && wasSyncingRef.current) {
      console.log(`Refresh complete — ${loadedCount} matches loaded`)
    }
    wasSyncingRef.current = isSyncing
  }, [isSyncing, loadedCount])
  useEffect(() => {
    if (progressLine) console.log(progressLine)
  }, [progressLine])

  if (isNotFound) {
    return (
      <div className={styles.notFoundPage}>
        <section className={styles.notFoundScene}>
          <p className={styles.kicker}>{t('matchHistory.notFoundKicker')}</p>
          <h1 className={styles.notFoundTitle}>{t('matchHistory.notFoundTitle', { id: requestedIds || 'Player' })}</h1>
          <p className={styles.notFoundCopy}>{t('matchHistory.notFoundCopy')}</p>
          <LandingSearchBar
            defaultRegion={region}
            defaultName={formatRiotId(gameName, tagLine)}
          />
        </section>
      </div>
    )
  }

  return (
    <PageShell>
      <div className={styles.playerSearch}>
        <SearchBar
          defaultRegion={region}
          defaultName2={formatRiotId(gameName2, tagLine2)}
        />
      </div>

      {isLoading && !data && (
        <div className={styles.loadingBlock}>
          <p className={styles.status} role="status">{t('matchHistory.loading')}</p>
          {rlStats && rlStats.queuedRequests > 5 && (
            <p className={styles.rateNote}>
              {t('matchHistory.rateNote', { size: rlStats.queuedRequests, used: rlStats.requestsLastMinute, limit: rlStats.limitPerMinute * 2 })}
            </p>
          )}
        </div>
      )}
      {isError && (
        <p className={styles.error} role="alert">
          {error?.response?.data?.error || t('matchHistory.error')}
        </p>
      )}
      {refreshMatches.isError && (
        <p className={styles.error} role="alert">
          {refreshError || t('matchHistory.refreshError')}
        </p>
      )}

      {data && syncErrors.length > 0 && (
        <div className={styles.syncNotice} role="alert">
          <p className={styles.syncTitle}>{t('matchHistory.syncPaused')}</p>
          <p className={styles.syncMeta}>{syncErrors[0].error || 'Refresh failed'}</p>
        </div>
      )}

      {data && (
        <>
          {isTwoPlayer ? (
            <>
              <SummonerProfileCard
                summoner={summonerData?.summoner}
                rankInfo={summonerData?.rankInfo || null}
                region={region}
                showBookmarkButton
                onRefresh={() => handleRefreshPlayer(id1)}
                isRefreshing={isRefreshingPlayer(id1, summonerData?.sync)}
                refreshDisabled={isSyncing}
              />
              <SummonerStatsCard
                matches={summonerData?.matches || []}
                resolvedChampions={champions || []}
                syncProgress={statsProgress1}
              />
              <LPGraph
                summoner={summonerData?.summoner}
                rankSnapshots={summonerData?.rankSnapshots || []}
                matches={summonerData?.matches || []}
              />
              <SummonerProfileCard
                summoner={summoner2Data?.summoner}
                rankInfo={summoner2Data?.rankInfo || null}
                region={region}
                onRefresh={() => handleRefreshPlayer(id2)}
                isRefreshing={isRefreshingPlayer(id2, summoner2Data?.sync)}
                refreshDisabled={isSyncing}
              />
              <SummonerStatsCard
                matches={summoner2Data?.matches || []}
                resolvedChampions={champions || []}
                syncProgress={statsProgress2}
              />
              <LPGraph
                summoner={summoner2Data?.summoner}
                rankSnapshots={summoner2Data?.rankSnapshots || []}
                matches={summoner2Data?.matches || []}
              />
            </>
          ) : (
            <>
              <SummonerProfileCard
                summoner={summonerData?.summoner}
                rankInfo={summonerData?.rankInfo || null}
                region={region}
                showBookmarkButton
                onRefresh={() => handleRefreshPlayer(id1)}
                isRefreshing={isRefreshingPlayer(id1, summonerData?.sync)}
                refreshDisabled={isSyncing}
              />
              <SummonerStatsCard
                matches={summonerData?.matches || []}
                resolvedChampions={champions || []}
                syncProgress={statsProgress1}
              />
              <LPGraph
                summoner={summonerData?.summoner}
                rankSnapshots={summonerData?.rankSnapshots || []}
                matches={summonerData?.matches || []}
              />
            </>
          )}
          {hasAnyMatches && (
            <TeammatesCard
              matches={summonerData?.matches || []}
              selectedPuuid={selectedTeammate1}
              onSelect={setSelectedTeammate1}
            />
          )}
          {isTwoPlayer && hasAnyMatches && (
            <TeammatesCard
              matches={summoner2Data?.matches || []}
              selectedPuuid={selectedTeammate2}
              onSelect={setSelectedTeammate2}
            />
          )}

          {showCachedShell ? (
          <p className={styles.emptyCache} role="status">{t('matchHistory.noCached')}</p>
          ) : (
            <>
              <h2 className={styles.recentGamesHeader}>{t('matchHistory.recentGames')}</h2>
              <MatchTable
                summonerData={filteredSummonerData}
                summoner2Data={filteredSummoner2Data}
                champions={champions || []}
                items={items || []}
                traits={traits || []}
                selectedTeammate1={selectedTeammate1}
                selectedTeammate2={selectedTeammate2}
              />
            </>
          )}
        </>
      )}

    </PageShell>
  )
}
