import { useTranslation } from 'react-i18next'
import { useBookmarkStore } from '../store/bookmarkStore.js'
import { isApexTier } from '../utils/lpFromRank.js'
import styles from './SummonerProfileCard.module.css'

const RANK_ICON_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/tftmobile/particles'

function getRankIconUrl(tier) {
  if (!tier) return null
  return `${RANK_ICON_BASE}/tft_regalia_${tier.toLowerCase()}.png`
}

function formatTier(tier) {
  if (!tier) return null
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function formatRank(rank) {
  const map = { I: 'I', II: 'II', III: 'III', IV: 'IV' }
  return map[rank] || rank || ''
}

function BookmarkToggleIcon({ filled }) {
  return (
    <svg width="13" height="15" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <path
        d="M2 1h10v14l-5-3.5L2 15V1z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

export default function SummonerProfileCard({
  summoner,
  region,
  showBookmarkButton = false,
  rankInfo,
  onRefresh,
  isRefreshing = false,
  refreshDisabled = false,
}) {
  const { t } = useTranslation()
  const { gameName, tagLine } = summoner || {}
  const bookmarks = useBookmarkStore(s => s.bookmarks)
  const addBookmark = useBookmarkStore(s => s.addBookmark)
  const removeBookmark = useBookmarkStore(s => s.removeBookmark)

  const canToggle = showBookmarkButton && gameName && tagLine && region
  const key = canToggle
    ? `${gameName.toLowerCase()}#${tagLine.toLowerCase()}@${region.toLowerCase()}`
    : null
  const isBookmarked = canToggle && bookmarks.some(
    b => `${b.gameName.toLowerCase()}#${b.tagLine.toLowerCase()}@${b.region.toLowerCase()}` === key
  )

  const handleToggle = () => {
    if (!canToggle) return
    if (isBookmarked) removeBookmark({ gameName, tagLine, region })
    else addBookmark({ gameName, tagLine, region })
  }

  return (
    <div className={styles.card}>
      <div className={styles.identityGroup}>
        <div className={styles.identity}>
          <span className={styles.name}>{gameName}</span>
          <span className={styles.tag}>#{tagLine}</span>
        </div>
        {onRefresh && (
          <button
            type="button"
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={refreshDisabled || isRefreshing}
            aria-label={t('summoner.refreshAriaLabel', { name: `${gameName}#${tagLine}` })}
            title={t('summoner.refreshTitle')}
          >
            {isRefreshing ? (
              <span className={styles.refreshingLabel}>
                {t('summoner.refreshing')}
                <span className={styles.dots} aria-hidden="true">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </span>
              </span>
            ) : t('summoner.refresh')}
          </button>
        )}
      </div>

      {rankInfo ? (
        <>
          <div className={styles.divider} />
          <div className={styles.rankBlock}>
            {getRankIconUrl(rankInfo.tier) && (
              <img
                src={getRankIconUrl(rankInfo.tier)}
                alt={rankInfo.tier}
                className={styles.rankIcon}
              />
            )}
            <div className={styles.rankText}>
              <span className={styles.tierLabel}>
                <span className={styles.tierName}>{formatTier(rankInfo.tier)}</span>
                {!isApexTier(rankInfo.tier) && formatRank(rankInfo.rank) && (
                  <span className={styles.division}>{formatRank(rankInfo.rank)}</span>
                )}
              </span>
              <span className={styles.lpLabel}>{rankInfo.leaguePoints} LP</span>
            </div>
          </div>

        </>
      ) : (
        <span className={styles.unranked}>{t('summoner.unranked')}</span>
      )}

      {canToggle && (
        <button
          type="button"
          className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarkBtnActive : ''}`}
          onClick={handleToggle}
          aria-pressed={isBookmarked}
        >
          <BookmarkToggleIcon filled={isBookmarked} />
          <span>{isBookmarked ? t('summoner.bookmarked') : t('summoner.bookmark')}</span>
        </button>
      )}
    </div>
  )
}
