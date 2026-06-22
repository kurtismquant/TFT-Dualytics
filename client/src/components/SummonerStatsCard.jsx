import { useMemo, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { lastRoundToStage } from '../utils/roundToStage.js'
import { useSettings } from '../contexts/useSettings.js'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '../hooks/useMediaQuery.js'
import styles from './SummonerStatsCard.module.css'
import { getCSSVar } from '../utils/cssVars.js'

// Compact mobile grid: 6 stats in a fixed order (2 rows × 3). The other stats
// (avg star level, team cost, eliminated) are dropped on mobile.
const MOBILE_STAT_KEYS = ['gamesPlayed', 'top2Rate', 'winRate', 'avgPlacement', 'avgDamage', 'avgLevel']

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function pct(count, total) {
  return total ? `${((count / total) * 100).toFixed(1)}%` : '-'
}

function computeStats(matches, champions) {
  if (!matches.length) return null
  const costMap = new Map(champions.map(c => [c.id, c.cost ?? 0]))
  const total = matches.length
  const allUnits = matches.flatMap(m => m.units)
  return {
    gamesPlayed: total,
    avgPlacement: avg(matches.map(m => m.teamPlacement)).toFixed(2),
    avgDamage: Math.round(avg(matches.map(m => m.totalDamageToPlayers))).toLocaleString(),
    top2Rate: pct(matches.filter(m => m.teamPlacement <= 2).length, total),
    winRate: pct(matches.filter(m => m.teamPlacement === 1).length, total),
    avgLevel: avg(matches.map(m => m.level)).toFixed(1),
    avgStarLevel: avg(allUnits.map(u => u.tier)).toFixed(2),
    avgTeamCost: avg(allUnits.map(u => costMap.get(u.id) ?? 0)).toFixed(1),
    avgEliminated: lastRoundToStage(Math.round(avg(matches.map(m => m.lastRound)))),
  }
}

export default function SummonerStatsCard({ matches, resolvedChampions }) {
  const { theme } = useSettings()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [activeBar, setActiveBar] = useState(null)
  const [activeX, setActiveX] = useState(null)

  const placementColors = useMemo(
    () => [1, 2, 3, 4].map(i => getCSSVar(`--placement-${i}`)),
    [theme]
  )

  const STAT_DEFS = [
    ['gamesPlayed', t('statsCard.gamesPlayed')],
    ['avgPlacement', t('statsCard.avgPlacement')],
    ['avgDamage', t('statsCard.avgDamage')],
    ['top2Rate', t('statsCard.top2Rate')],
    ['winRate', t('statsCard.winRate')],
    ['avgLevel', t('statsCard.avgLevel')],
    ['avgStarLevel', t('statsCard.avgStarLevel')],
    ['avgTeamCost', t('statsCard.avgTeamCost')],
    ['avgEliminated', t('statsCard.avgEliminated')],
  ]

  // Mobile shows a reordered subset; desktop keeps the full list.
  const visibleStats = isMobile
    ? MOBILE_STAT_KEYS.map(k => STAT_DEFS.find(([key]) => key === k)).filter(Boolean)
    : STAT_DEFS

  const cs = getComputedStyle(document.documentElement)
  const axisColor = cs.getPropertyValue('--chart-axis-color').trim()
  const gridColor = cs.getPropertyValue('--chart-grid-color').trim()

  const AXIS_STYLE = {
    fill: axisColor,
    fontSize: 10,
    fontFamily: 'D-DIN, Arial, sans-serif',
    textTransform: 'uppercase',
  }

  const stats = useMemo(
    () => computeStats(matches, resolvedChampions ?? []),
    [matches, resolvedChampions],
  )

  const barData = useMemo(() => {
    const recent = matches.slice(0, 20)
    return [1, 2, 3, 4].map((p, i) => ({
      label: [t('placement.1'), t('placement.2'), t('placement.3'), t('placement.4')][i],
      count: recent.filter(m => m.teamPlacement === p).length,
    }))
  }, [matches, t])

  if (!stats) return null

  const chartCount = Math.min(matches.length, 20)

  return (
    <div className={styles.card}>
      <div className={styles.statsGrid}>
        {visibleStats.map(([key, label]) => (
          <div key={key} className={styles.statItem}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>{stats[key]}</span>
          </div>
        ))}
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartWrap}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>{t('statsCard.chartTitle')}</span>
            <span className={styles.chartSub}>{t('statsCard.chartSub', { count: chartCount })}</span>
          </div>
          <div className={styles.chartCanvas}>
            {activeBar != null && activeX != null && barData[activeBar] && (
              <div
                className={styles.hoverCard}
                style={{ left: activeX }}
                aria-hidden="true"
              >
                {barData[activeBar].label} · {barData[activeBar].count} {t('statsCard.games')}
              </div>
            )}
            <ResponsiveContainer key={theme} width="100%" height={180}>
              <BarChart
                data={barData}
                barCategoryGap="30%"
                onMouseMove={state => {
                  setActiveBar(state?.activeTooltipIndex ?? null)
                  setActiveX(state?.activeCoordinate?.x ?? null)
                }}
                onMouseLeave={() => {
                  setActiveBar(null)
                  setActiveX(null)
                }}
              >
                <CartesianGrid vertical={false} stroke={gridColor} />
                <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={24} />
                {/* Tooltip renders nothing; it stays mounted so recharts keeps
                    computing activeTooltipIndex / activeCoordinate for the band
                    hover, which drives the glow and the anchored card above. */}
                <Tooltip cursor={false} content={() => null} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {barData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={placementColors[i]}
                      fillOpacity={activeBar === i ? 1 : 0.85}
                      style={{
                        filter: activeBar === i
                          ? `brightness(1.12) drop-shadow(0 0 6px ${placementColors[i]})`
                          : 'none',
                        transition: 'filter 0.15s ease, fill-opacity 0.15s ease',
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
