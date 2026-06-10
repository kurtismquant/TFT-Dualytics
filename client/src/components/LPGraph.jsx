import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  formatRankLabel,
  rankFromLp,
  TIER_THRESHOLDS,
  APEX_LP_BASE,
} from '../utils/lpFromRank.js'
import { getCSSVar } from '../utils/cssVars.js'
import { estimateMatchLp } from '../utils/estimateMatchLp.js'
import { useSettings } from '../contexts/useSettings.js'
import { useTranslation } from 'react-i18next'
import styles from './LPGraph.module.css'

function getCutoffMs(matches, rangeValue) {
  if (rangeValue === 'all' || !matches?.length) return 0
  const n = parseInt(rangeValue, 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  const sorted = [...matches].sort((a, b) => b.date - a.date)
  const target = sorted[Math.min(n, sorted.length) - 1]
  return target?.date ?? 0
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipLabel}>{formatDate(p.ts)}</span>
      <span>{formatRankLabel(p)}</span>
    </div>
  )
}

function CustomDot(props) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  const cs = getComputedStyle(document.documentElement)
  return <circle cx={cx} cy={cy} r={3.5} fill="#ffffff" stroke={cs.getPropertyValue('--chart-tooltip-bg').trim()} strokeWidth={1} />
}

export default function LPGraph({ summoner, rankSnapshots, matches }) {
  const { theme } = useSettings()
  const { t } = useTranslation()
  const [range, setRange] = useState('20')

  const cs = getComputedStyle(document.documentElement)
  const axisColor = cs.getPropertyValue('--chart-axis-color').trim()
  const gridColor = cs.getPropertyValue('--chart-grid-color').trim()
  const lineColor = cs.getPropertyValue('--chart-line-color').trim()
  const cursorColor = cs.getPropertyValue('--chart-cursor-color').trim()

  const AXIS_STYLE = {
    fill: axisColor,
    fontSize: 10,
    fontFamily: 'D-DIN, Arial, sans-serif',
  }

  const RANGE_OPTIONS = [
    { value: '20', label: t('lpGraph.range20') },
    { value: '50', label: t('lpGraph.range50') },
    { value: '100', label: t('lpGraph.range100') },
    { value: 'all', label: t('lpGraph.rangeAll') },
  ]

  const allPoints = useMemo(
    () => estimateMatchLp(rankSnapshots, matches),
    [rankSnapshots, matches],
  )

  const pointsWithDelta = useMemo(() => {
    if (!allPoints.length) return []
    const cutoff = getCutoffMs(matches || [], range)
    const filtered = cutoff ? allPoints.filter(p => p.ts >= cutoff) : allPoints
    // Index is used as the X-axis position so points are spaced evenly
    // regardless of real-time gaps between matches.
    return filtered.map((p, i) => ({ ...p, idx: i }))
  }, [allPoints, matches, range])

  const yDomain = useMemo(() => {
    if (!pointsWithDelta.length) return [0, APEX_LP_BASE]
    const values = pointsWithDelta.map(p => p.absLp)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max(50, (max - min) * 0.15)
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }, [pointsWithDelta])

  const visibleThresholds = useMemo(
    () => TIER_THRESHOLDS.filter(t => t.absLp > yDomain[0] && t.absLp < yDomain[1]),
    [yDomain],
  )

  const lpStep = useMemo(() => {
    const apexLow = Math.max(APEX_LP_BASE, yDomain[0])
    const apexRange = yDomain[1] - apexLow
    return apexRange > 600 ? 200 : 100
  }, [yDomain])

  const yTicks = useMemo(() => {
    const set = new Set()
    // Non-apex region: only mark tier boundaries (e.g. DIAMOND, EMERALD)
    TIER_THRESHOLDS.forEach(t => {
      if (t.absLp < APEX_LP_BASE && t.absLp >= yDomain[0] && t.absLp <= yDomain[1]) {
        set.add(t.absLp)
      }
    })
    // Apex region: ticks every lpStep (100 or 200)
    const apexStart = Math.max(
      APEX_LP_BASE,
      Math.ceil(yDomain[0] / lpStep) * lpStep,
    )
    const apexEnd = Math.floor(yDomain[1] / lpStep) * lpStep
    for (let lp = apexStart; lp <= apexEnd; lp += lpStep) set.add(lp)
    return [...set].sort((a, b) => a - b)
  }, [yDomain, lpStep])

  const summonerName = summoner?.gameName ? `${summoner.gameName}#${summoner.tagLine}` : 'Player'
  const isEmpty = pointsWithDelta.length < 2

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>{t('lpGraph.title', { name: summonerName })}</span>
          <span className={styles.sub}>
            {pointsWithDelta.length > 0
              ? t('lpGraph.matches', { count: pointsWithDelta.length })
              : t('lpGraph.noData')}
          </span>
        </div>
        <select
          className={styles.select}
          value={range}
          onChange={e => setRange(e.target.value)}
          aria-label={t('lpGraph.rangeLabel')}
        >
          {RANGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {isEmpty ? (
        <div className={styles.empty}>
          {pointsWithDelta.length === 1
            ? t('lpGraph.emptyOne')
            : t('lpGraph.emptyRange')}
        </div>
      ) : (
        <ResponsiveContainer key={theme} width="100%" height={240}>
          <LineChart data={pointsWithDelta} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="2 6" strokeOpacity={0.25} />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, pointsWithDelta.length - 1]}
              tickFormatter={i => {
                const p = pointsWithDelta[i]
                return p ? formatDate(p.ts) : ''
              }}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              tick={({ x, y, payload }) => {
                const v = payload.value
                let label = ''
                let fill = axisColor
                let letterSpacing = 0
                let opacity = 0.6
                if (v >= APEX_LP_BASE) {
                  const r = rankFromLp(v)
                  label = r ? String(r.leaguePoints) : ''
                } else {
                  const threshold = TIER_THRESHOLDS.find(
                    t => t.absLp === v && t.absLp < APEX_LP_BASE,
                  )
                  if (threshold) {
                    label = threshold.tier
                    fill = getCSSVar(`--tier-${threshold.tier.toLowerCase()}`) || axisColor
                    letterSpacing = 1
                    opacity = 0.85
                  }
                }
                return (
                  <text
                    x={x}
                    y={y}
                    dy={4}
                    textAnchor="end"
                    fill={fill}
                    fontSize={10}
                    fontFamily="D-DIN, Arial, sans-serif"
                    letterSpacing={letterSpacing}
                    opacity={opacity}
                  >
                    {label}
                  </text>
                )
              }}
              axisLine={false}
              tickLine={false}
              width={72}
              interval={0}
            />
            {visibleThresholds.map(t => (
              <ReferenceLine
                key={t.tier + t.absLp}
                y={t.absLp}
                stroke={getCSSVar(`--tier-${t.tier.toLowerCase()}`)}
                strokeDasharray="2 4"
                strokeOpacity={0.35}
              />
            ))}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: cursorColor }} />
            <Line
              type="monotone"
              dataKey="absLp"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: lineColor, stroke: cs.getPropertyValue('--chart-tooltip-bg').trim(), strokeWidth: 1 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
