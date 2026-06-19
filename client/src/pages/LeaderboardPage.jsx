import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLeaderboard } from '../hooks/useLeaderboard.js'
import { LEADERBOARD_REGION_OPTIONS } from '../constants/regions.js'
import { buildSummonerPath } from '../constants/routes.js'
import { PageShell } from '../components/layout/PageShell.jsx'
import styles from './LeaderboardPage.module.css'
import { getCSSVar } from '../utils/cssVars.js'
import { getRankIconUrl } from '../utils/rankIcon.js'

const TIER_ORDER = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD']
const DIVISION_ORDER = { I: 0, II: 1, III: 2, IV: 3, '': 0 }

const ROWS_PER_PAGE = 100

const formatTier = (tier) => tier ? tier.charAt(0) + tier.slice(1).toLowerCase() : ''

function getWinRateQualityKey(value) {
  const winRate = Number(value)
  if (!Number.isFinite(winRate)) return 'unknown'
  const percent = winRate <= 1 ? winRate * 100 : winRate
  if (percent >= 45) return 'excellent'
  if (percent >= 35) return 'good'
  if (percent >= 25) return 'average'
  return 'low'
}

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const [region, setRegion] = useState('na')
  const [sortKey, setSortKey] = useState('rank')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)

  // Swap the region pills for a dropdown the moment they'd wrap onto a second
  // row. A hidden, no-wrap copy of the pills measures their intrinsic one-row
  // width; if that exceeds the available width, we render the dropdown instead.
  const regionRowRef = useRef(null)
  const regionMeasureRef = useRef(null)
  const [regionAsDropdown, setRegionAsDropdown] = useState(false)

  useLayoutEffect(() => {
    const row = regionRowRef.current
    const measure = regionMeasureRef.current
    if (!row || !measure) return undefined
    const check = () => {
      // -2px accounts for the rendered bar's 1px border on each side.
      setRegionAsDropdown(measure.scrollWidth > row.clientWidth - 2)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(row)
    return () => ro.disconnect()
  }, [])

  const { data, isLoading, isError } = useLeaderboard(region)
  const entries = useMemo(() => data?.entries ?? [], [data])
  const refreshing = data?.refreshing ?? false

  const handleRegionChange = (code) => {
    setRegion(code)
    setPage(0)
    setSortKey('rank')
    setSortAsc(true)
  }

  const enriched = useMemo(() => entries.map(e => {
    const games = (e.wins ?? 0) + (e.losses ?? 0)
    const winRate = games > 0 ? (e.wins ?? 0) / games : 0
    return { ...e, games, winRate }
  }), [entries])

  const sorted = useMemo(() => {
    const arr = [...enriched]
    const dir = sortAsc ? 1 : -1
    arr.sort((a, b) => {
      if (sortKey === 'name') {
        return dir * (a.gameName || '').localeCompare(b.gameName || '')
      }
      if (sortKey === 'tier') {
        const ta = TIER_ORDER.indexOf(a.tier)
        const tb = TIER_ORDER.indexOf(b.tier)
        if (ta !== tb) return dir * (ta - tb)
        const da = DIVISION_ORDER[a.division] ?? 0
        const db = DIVISION_ORDER[b.division] ?? 0
        if (da !== db) return dir * (da - db)
        return dir * (b.lp - a.lp)
      }
      return dir * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0))
    })
    return arr
  }, [enriched, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE))
  const pageData = sorted.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      // Rank/games default ascending; rate/tier default descending-ish
      setSortAsc(key === 'rank' || key === 'name')
    }
  }

  // hideMobile columns drop off at --bp-md so Rank / Player / Tier-LP fit the screen.
  const columns = [
    { key: 'rank', label: t('leaderboard.colRank'), align: 'center' },
    { key: 'name', label: t('leaderboard.colPlayer'), align: 'left' },
    { key: 'tier', label: t('leaderboard.colLP'), align: 'left' },
    { key: 'games', label: t('leaderboard.colGames'), align: 'right', hideMobile: true },
    { key: 'winRate', label: t('leaderboard.colWinRate'), align: 'right', hideMobile: true },
  ]

  const updatedLabel = data?.updatedAt
    ? t('leaderboard.updatedAt', { date: new Date(data.updatedAt).toLocaleString() })
    : refreshing
      ? t('leaderboard.fetching')
      : ''

  const showPlaceholder = entries.length === 0
  const tableDescriptionId = 'leaderboard-table-description'

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    if (page < 3) return [0, 1, 2, 3, 4, 5, 6]
    if (page > totalPages - 4) return Array.from({ length: 7 }, (_, i) => totalPages - 7 + i)
    return Array.from({ length: 7 }, (_, i) => page - 3 + i)
  })()

  return (
    <div className={styles.page}>
      <PageShell>
        <h1 className={styles.title}>{t('leaderboard.title')}</h1>

        {/* Pills until they'd wrap; then a dropdown. The hidden measurer mirrors
            the pills at their natural one-row width so we can detect the wrap. */}
        <div className={styles.regionRow} ref={regionRowRef}>
          <div className={styles.regionMeasure} aria-hidden="true" ref={regionMeasureRef}>
            {LEADERBOARD_REGION_OPTIONS.map(r => (
              <span key={r.code} className={styles.regionPill}>{r.label}</span>
            ))}
          </div>

          {regionAsDropdown ? (
            <div className={styles.regionSelectWrap}>
              <label className="sr-only" htmlFor="leaderboard-region">{t('leaderboard.regionLabel')}</label>
              <select
                id="leaderboard-region"
                className={styles.regionSelect}
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
              >
                {LEADERBOARD_REGION_OPTIONS.map(r => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.regionBar} role="group" aria-label={t('leaderboard.regionLabel')}>
              {LEADERBOARD_REGION_OPTIONS.map(r => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => handleRegionChange(r.code)}
                  className={`${styles.regionPill} ${region === r.code ? styles.regionPillActive : ''}`}
                  aria-pressed={region === r.code}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.tableWrap} aria-busy={isLoading || refreshing}>
          {isError ? (
            <div className={styles.placeholder} role="alert">
              {t('leaderboard.error')}
            </div>
          ) : showPlaceholder ? (
            <div className={styles.placeholder} role="status" aria-live="polite">
              {isLoading || refreshing
                ? t('leaderboard.loading')
                : t('leaderboard.noData')}
            </div>
          ) : (
            <>
              <div className={styles.scroller}>
                <p id={tableDescriptionId} className="sr-only">{t('leaderboard.tableDescription')}</p>
                <table className={styles.table} aria-describedby={tableDescriptionId}>
                  <caption className="sr-only">{t('leaderboard.tableCaption', { region: region.toUpperCase() })}</caption>
                  <thead>
                    <tr>
                      {columns.map(col => (
                        <th
                          key={col.key}
                          className={`${styles.th} ${sortKey === col.key ? styles.thActive : ''} ${col.hideMobile ? styles.colHideMobile : ''}`}
                          style={{ textAlign: col.align }}
                          scope="col"
                          aria-sort={sortKey === col.key ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                        >
                          <button
                            type="button"
                            className={styles.sortButton}
                            onClick={() => handleSort(col.key)}
                            aria-label={t('leaderboard.sortBy', { column: col.label })}
                          >
                            {col.label}
                            {sortKey === col.key && (
                              <span className={styles.sortArrow} aria-hidden="true">{sortAsc ? '▲' : '▼'}</span>
                            )}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((p, i) => {
                      const winRateValue = `${(p.winRate * 100).toFixed(1)}%`
                      const winRateQuality = t(`stats.metric.${getWinRateQualityKey(p.winRate)}`)

                      return (
                      <tr
                        key={p.puuid || p.rank}
                        className={`${styles.row} ${i % 2 === 0 ? styles.rowEven : styles.rowOdd}`}
                      >
                        <td className={`${styles.td} ${styles.tdRank}`}>{p.rank}</td>
                        <th scope="row" className={`${styles.td} ${styles.rowHeader}`}>
                          {p.gameName && p.tagLine ? (
                            <Link
                              to={buildSummonerPath(region, p)}
                              className={styles.playerLink}
                            >
                              <span className={styles.playerName}>{p.gameName}</span>
                              <span className={styles.playerTag}>#{p.tagLine}</span>
                            </Link>
                          ) : (
                            <span className={styles.playerName}>{p.gameName || '-'}</span>
                          )}
                        </th>
                        <td className={styles.td}>
                          <div className={styles.tierBadge}>
                            {getRankIconUrl(p.tier) && (
                              <img
                                src={getRankIconUrl(p.tier)}
                                alt={formatTier(p.tier)}
                                className={styles.rankIconMobile}
                                loading="lazy"
                              />
                            )}
                            <span
                              className={styles.tierLabel}
                              style={{ color: getCSSVar(`--tier-${p.tier.toLowerCase()}`) || 'var(--text-muted)' }}
                            >
                              {formatTier(p.tier)}{p.division && p.tier && !['CHALLENGER','GRANDMASTER','MASTER'].includes(p.tier) ? ` ${p.division}` : ''}
                            </span>
                            <span className={styles.lpValue}>{p.lp} LP</span>
                          </div>
                        </td>
                        <td className={`${styles.td} ${styles.tdNum} ${styles.colHideMobile}`}>{p.games}</td>
                        <td
                          className={`${styles.td} ${styles.tdRate} ${styles.colHideMobile} ${p.winRate >= 0.45 ? styles.rateGold : ''}`}
                          aria-label={`${t('leaderboard.colWinRate')}: ${winRateValue}. ${t('stats.metricLabel')}: ${winRateQuality}`}
                        >
                          {winRateValue}
                          <span className={styles.rateLabel}>{winRateQuality}</span>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  {t('leaderboard.page', { current: page + 1, total: totalPages })}
                </span>
                <div className={styles.paginationButtons}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    {t('leaderboard.prev')}
                  </button>
                  {pageNumbers.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`${styles.pageNum} ${page === n ? styles.pageNumActive : ''}`}
                      aria-current={page === n ? 'page' : undefined}
                    >
                      {n + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page === totalPages - 1}
                  >
                    {t('leaderboard.next')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {updatedLabel && <div className={styles.metaLine} role={refreshing ? 'status' : undefined}>{updatedLabel}</div>}
      </PageShell>
    </div>
  )
}
