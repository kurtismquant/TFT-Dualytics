import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './TeammatesCard.module.css'

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
    </svg>
  )
}

function computeTeammates(matches) {
  const map = new Map()
  for (const match of matches) {
    if (!match.partnerPuuid) continue
    const key = match.partnerPuuid
    if (!map.has(key)) {
      map.set(key, {
        puuid: match.partnerPuuid,
        gameName: match.partnerGameName || 'Unknown',
        tagLine: match.partnerTagLine || '',
        count: 0,
        totalPlacement: 0,
        wins: 0,
        top2: 0,
      })
    }
    const e = map.get(key)
    e.count++
    e.totalPlacement += match.teamPlacement ?? 0
    if (match.teamPlacement === 1) e.wins++
    if (match.teamPlacement <= 2) e.top2++
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map(e => ({
      ...e,
      avgPlacement: (e.totalPlacement / e.count).toFixed(2),
      winRate: `${((e.wins / e.count) * 100).toFixed(1)}%`,
      top2Rate: `${((e.top2 / e.count) * 100).toFixed(1)}%`,
    }))
}

export default function TeammatesCard({ matches, selectedPuuid, onSelect }) {
  const { t } = useTranslation()
  const [tipDismissed, setTipDismissed] = useState(false)

  const teammates = useMemo(() => computeTeammates(matches), [matches])

  if (teammates.length === 0) return null

  const showTip = !tipDismissed && !selectedPuuid

  function handleRowClick(puuid) {
    setTipDismissed(true)
    onSelect(selectedPuuid === puuid ? null : puuid)
  }

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrapper}>
          <span className={styles.title}>{t('teammates.title')}</span>
          {showTip && (
            <div
              className={styles.tip}
              role="status"
              onClick={() => setTipDismissed(true)}
            >
              <span className={styles.tipText}>{t('teammates.tip')}</span>
              <button
                type="button"
                className={styles.tipClose}
                onClick={() => setTipDismissed(true)}
                aria-label={t('teammates.dismissTip')}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className={styles.headerRight}>
          {selectedPuuid && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => onSelect(null)}
              aria-label={t('teammates.clearAriaLabel')}
            >
              {t('teammates.clearFilter')}
            </button>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableScroll}>
        <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            <th className={styles.th}>{t('teammates.colTeammate')}</th>
            <th className={`${styles.th} ${styles.num}`}>{t('teammates.colGames')}</th>
            <th className={`${styles.th} ${styles.num}`}>{t('teammates.colAvgPlace')}</th>
            <th className={`${styles.th} ${styles.num}`}>{t('teammates.colWinRate')}</th>
            <th className={`${styles.th} ${styles.num}`}>{t('teammates.colTop2Rate')}</th>
            <th className={styles.thIcon} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {teammates.map(tm => {
            const isActive = selectedPuuid === tm.puuid
            return (
              <tr
                key={tm.puuid}
                className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
                onClick={() => handleRowClick(tm.puuid)}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleRowClick(tm.puuid)}
              >
                <td className={styles.td}>
                  <span className={styles.playerName}>{tm.gameName}</span>
                  {tm.tagLine && <span className={styles.playerTag}>#{tm.tagLine}</span>}
                </td>
                <td className={`${styles.td} ${styles.num}`}>{tm.count}</td>
                <td className={`${styles.td} ${styles.num}`}>{tm.avgPlacement}</td>
                <td className={`${styles.td} ${styles.num}`}>{tm.winRate}</td>
                <td className={`${styles.td} ${styles.num}`}>{tm.top2Rate}</td>
                <td className={styles.tdIcon}>
                  <span className={styles.rowIcon}>
                    <FilterIcon />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
