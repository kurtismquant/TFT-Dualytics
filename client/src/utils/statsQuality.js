// Threshold tables that classify a row's average placement and win rate into
// a color and a qualitative bucket key (used as an i18n key suffix).
//
// The color and quality bands intentionally use different cut points: colors
// are a finer gradient than the four quality buckets shown in screen-reader
// labels, so the two are kept as independent tables instead of fused.

const AVG_PLACEMENT_COLOR_BANDS = [
  { max: 1.85, color: '#22C55E' },
  { max: 2.0, color: '#65C95A' },
  { max: 2.15, color: '#A3CF4A' },
  { max: 2.25, color: '#FACC15' },
  { max: 2.35, color: '#F59E0B' },
  { max: 2.5, color: '#EF6A24' },
]
const AVG_PLACEMENT_FALLBACK_COLOR = '#DC2626'

const AVG_PLACEMENT_QUALITY_BANDS = [
  { max: 1.85, quality: 'excellent' },
  { max: 2.15, quality: 'good' },
  { max: 2.35, quality: 'average' },
]
const AVG_PLACEMENT_FALLBACK_QUALITY = 'low'

const WIN_RATE_COLOR_BANDS = [
  { min: 37.5, color: '#22C55E' },
  { min: 32.5, color: '#65C95A' },
  { min: 28, color: '#A3CF4A' },
  { min: 25, color: '#FACC15' },
  { min: 22, color: '#F59E0B' },
  { min: 17.5, color: '#EF6A24' },
]
const WIN_RATE_FALLBACK_COLOR = '#DC2626'

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
