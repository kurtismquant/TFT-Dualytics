// Threshold tables that classify a row's average placement and win rate into
// a color and a qualitative bucket key (used as an i18n key suffix).
//
// The color and quality bands intentionally use different cut points: colors
// are a finer gradient than the four quality buckets shown in screen-reader
// labels, so the two are kept as independent tables instead of fused.

const AVG_PLACEMENT_COLOR_BANDS = [
  { max: 2.1,  color: 'var(--stat-tier-0)' },
  { max: 2.35, color: 'var(--stat-tier-1)' },
  { max: 2.5,  color: 'var(--stat-tier-2)' },
  { max: 2.65, color: 'var(--stat-tier-3)' },
  { max: 2.9,  color: 'var(--stat-tier-4)' },
]
const AVG_PLACEMENT_FALLBACK_COLOR = 'var(--stat-tier-5)'

const AVG_PLACEMENT_QUALITY_BANDS = [
  { max: 1.85, quality: 'excellent' },
  { max: 2.15, quality: 'good' },
  { max: 2.35, quality: 'average' },
]
const AVG_PLACEMENT_FALLBACK_QUALITY = 'low'

const WIN_RATE_COLOR_BANDS = [
  { min: 30, color: 'var(--stat-tier-0)' },
  { min: 27, color: 'var(--stat-tier-1)' },
  { min: 25, color: 'var(--stat-tier-2)' },
  { min: 23, color: 'var(--stat-tier-3)' },
  { min: 20, color: 'var(--stat-tier-4)' },
]
const WIN_RATE_FALLBACK_COLOR = 'var(--stat-tier-5)'

const WIN_RATE_QUALITY_BANDS = [
  { min: 32.5, quality: 'excellent' },
  { min: 28, quality: 'good' },
  { min: 22, quality: 'average' },
]
const WIN_RATE_FALLBACK_QUALITY = 'low'

function toPercent(winRate) {
  return winRate <= 1 ? winRate * 100 : winRate
}

export function getAvgPlacementColor(value) {
  const placement = Number(value)
  if (!Number.isFinite(placement)) return undefined
  return (
    AVG_PLACEMENT_COLOR_BANDS.find(b => placement <= b.max)?.color
    || AVG_PLACEMENT_FALLBACK_COLOR
  )
}

export function getWinRateColor(value) {
  const winRate = Number(value)
  if (!Number.isFinite(winRate)) return undefined
  const percent = toPercent(winRate)
  return (
    WIN_RATE_COLOR_BANDS.find(b => percent >= b.min)?.color
    || WIN_RATE_FALLBACK_COLOR
  )
}

export function getAvgPlacementQualityKey(value) {
  const placement = Number(value)
  if (!Number.isFinite(placement)) return 'unknown'
  return (
    AVG_PLACEMENT_QUALITY_BANDS.find(b => placement <= b.max)?.quality
    || AVG_PLACEMENT_FALLBACK_QUALITY
  )
}

export function getWinRateQualityKey(value) {
  const winRate = Number(value)
  if (!Number.isFinite(winRate)) return 'unknown'
  const percent = toPercent(winRate)
  return (
    WIN_RATE_QUALITY_BANDS.find(b => percent >= b.min)?.quality
    || WIN_RATE_FALLBACK_QUALITY
  )
}
