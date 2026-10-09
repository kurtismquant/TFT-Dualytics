import { useTranslation } from 'react-i18next'
import RangeStopSlider from './RangeStopSlider.jsx'
import UnitRangeReadout from './UnitRangeReadout.jsx'
import { ITEM_COUNT_LEVELS, STAR_COLORS, STAR_LEVELS, unitRangeSummary } from '../../utils/starRange.js'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import styles from './UnitRangeFilters.module.css'

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
  const { t, i18n } = useTranslation()
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

  // The current selection beside each label: "All", "2★", "2★–3★", "1–3 items".
  const rangeText = (range, levels, single, span) => {
    if (range.min === levels[0] && range.max === levels[levels.length - 1]) return t('unit.rangeAll')
    return range.min === range.max ? single(range.min) : span(range)
  }
  const compact = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
  const gamesCaption = summary => (summary.games ? compact.format(summary.games) : '–')

  return (
    <div className={styles.row}>
      <RangeStopSlider
        label={t('unit.starRangeLabel')}
        rangeText={rangeText(starRange, STAR_LEVELS, starText, r => t('unit.starRange', r))}
        stopCaption={hasStars ? star => gamesCaption(starSummary(star)) : undefined}
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
        rangeText={rangeText(itemRange, ITEM_COUNT_LEVELS, itemText, r => t('unit.itemRange', r))}
        stopCaption={hasItems ? count => gamesCaption(itemSummary(count)) : undefined}
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
