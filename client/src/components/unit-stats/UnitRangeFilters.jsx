import { useTranslation } from 'react-i18next'
import RangeStopSlider from './RangeStopSlider.jsx'
import UnitRangeReadout from './UnitRangeReadout.jsx'
import { ITEM_COUNT_LEVELS, STAR_LEVELS, unitRangeSummary } from '../../utils/starRange.js'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import styles from './UnitRangeFilters.module.css'

const STAR_COLORS = {
  1: 'var(--bronze-star-level)',
  2: 'var(--silver-star-level)',
  3: 'var(--gold-star-level)',
}

// Items held has no game meaning to colour by, so it ramps a neutral tone from
// faint (0 items) to full text colour (3 items).
const ITEM_COLORS = {
  0: 'color-mix(in srgb, var(--text-primary) 35%, transparent)',
  1: 'color-mix(in srgb, var(--text-primary) 55%, transparent)',
  2: 'color-mix(in srgb, var(--text-primary) 78%, transparent)',
  3: 'var(--text-primary)',
}

// Star-level slider, items-held slider and the readout for both ranges, in one
// row. `unit` carries byStar / byStarItems; without them (docs stored before
// that data existed) the sliders are disabled and the readout uses `fallback`.
export default function UnitRangeFilters({ unit, starRange, itemRange, onStarRangeChange, onItemRangeChange, fallback }) {
  const { t } = useTranslation()
  const hasStars = Boolean(unit.byStar)
  const hasItems = Boolean(unit.byStarItems)
  const starText = star => t('unit.starLevel', { count: star })
  const itemText = count => t('unit.itemLevel', { count })

  // Each level's numbers are shown within the other slider's current range.
  const tip = (levelText, summary) => (summary.games
    ? t('unit.levelTip', {
      level: levelText,
      avg: formatAvg(summary.avgPlacement),
      win: formatPercent(summary.winRate),
      games: summary.games.toLocaleString(),
    })
    : t('unit.levelNoGames', { level: levelText }))
  const starSummary = star => unitRangeSummary(unit, { min: star, max: star }, itemRange)
  const itemSummary = count => unitRangeSummary(unit, starRange, { min: count, max: count })
  const selectLabel = text => t('unit.showOnlyLevel', { tip: text })

  return (
    <div className={styles.row}>
      <RangeStopSlider
        label={t('unit.starRangeLabel')}
        levels={STAR_LEVELS}
        range={starRange}
        onChange={onStarRangeChange}
        disabled={!hasStars}
        minLabel={t('unit.minStar')}
        maxLabel={t('unit.maxStar')}
        colorFor={star => STAR_COLORS[star]}
        stopContent={star => '★'.repeat(star)}
        valueText={starText}
        tipFor={star => tip(starText(star), starSummary(star))}
        selectLabel={selectLabel}
        isEmpty={star => hasStars && !starSummary(star).games}
      />
      <RangeStopSlider
        label={t('unit.itemRangeLabel')}
        levels={ITEM_COUNT_LEVELS}
        range={itemRange}
        onChange={onItemRangeChange}
        disabled={!hasItems}
        minLabel={t('unit.minItems')}
        maxLabel={t('unit.maxItems')}
        colorFor={count => ITEM_COLORS[count]}
        stopContent={count => count}
        valueText={itemText}
        tipFor={count => tip(itemText(count), itemSummary(count))}
        selectLabel={selectLabel}
        isEmpty={count => hasItems && !itemSummary(count).games}
      />
      <UnitRangeReadout summary={hasStars ? unitRangeSummary(unit, starRange, itemRange) : fallback} />
    </div>
  )
}
