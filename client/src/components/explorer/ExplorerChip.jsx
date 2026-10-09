import { useTranslation } from 'react-i18next'
import RangeStopSlider from '../unit-stats/RangeStopSlider.jsx'
import { getTraitTierInfo } from '../../utils/traitTier.js'
import { STAR_COLORS, STAR_LEVELS } from '../../utils/starRange.js'
import { MAX_UNIT_ITEMS } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

// Slider range ↔ a unit filter's { minStar, maxStar } (1★–3★ = any, so neither is kept).
const starRangeOf = entry => ({ min: entry.minStar || 1, max: entry.maxStar || 3 })

function withStarRange(entry, { min, max }) {
  const { minStar: _min, maxStar: _max, ...rest } = entry
  return { ...rest, ...(min > 1 ? { minStar: min } : {}), ...(max < 3 ? { maxStar: max } : {}) }
}

// Breakpoints of a trait as minimum active tiers ("3+ Blossom").
function traitBreakpoints(meta) {
  const options = []
  for (let tier = 1; tier <= 6; tier += 1) {
    const { minUnits } = getTraitTierInfo(meta, tier)
    if (minUnits == null) break
    options.push({ tier, minUnits })
  }
  return options
}

// One active explorer filter with its own controls.
export default function ExplorerChip({ kind, entry, lookups, heldItemOptions, onChange, onRemove }) {
  const { t } = useTranslation()
  const id = kind === 'item' ? entry : entry.id
  const meta = lookups[kind].get(id)
  const name = meta?.name || id

  return (
    <li className={styles.chip} data-kind={kind}>
      {meta?.iconUrl && <img src={meta.iconUrl} alt="" className={styles.chipIcon} />}
      <span className={styles.chipName}>{name}</span>

      {kind === 'unit' && (
        <>
          <RangeStopSlider
            compact
            label={t('explorer.starLabel', { name })}
            levels={STAR_LEVELS}
            range={starRangeOf(entry)}
            onChange={range => onChange(withStarRange(entry, range))}
            minLabel={t('explorer.minStar', { name })}
            maxLabel={t('explorer.maxStar', { name })}
            colorFor={star => STAR_COLORS[star]}
            stopContent={star => '★'.repeat(star)}
            valueText={star => t('unit.starLevel', { count: star })}
            tipFor={star => t('unit.starLevel', { count: star })}
            selectLabel={text => t('unit.showOnlyLevel', { tip: text })}
          />
          {entry.items.map(itemId => {
            const item = lookups.item.get(itemId)
            return (
              <button
                key={itemId}
                type="button"
                className={styles.heldItem}
                onClick={() => onChange({ ...entry, items: entry.items.filter(i => i !== itemId) })}
                aria-label={t('explorer.removeHeldItem', { item: item?.name || itemId, name })}
                title={item?.name || itemId}
              >
                {item?.iconUrl ? <img src={item.iconUrl} alt="" /> : '?'}
              </button>
            )
          })}
          {entry.items.length < MAX_UNIT_ITEMS && (
            <select
              className={`${styles.chipSelect} ${styles.addItemSelect}`}
              value=""
              onChange={event => event.target.value && onChange({ ...entry, items: [...entry.items, event.target.value] })}
              aria-label={t('explorer.addHeldItem', { name })}
            >
              <option value="">{t('explorer.holding')}</option>
              {heldItemOptions.filter(item => !entry.items.includes(item.id)).map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}
        </>
      )}

      {kind === 'trait' && (
        <select
          className={styles.chipSelect}
          value={entry.minTier || ''}
          onChange={event => onChange(event.target.value ? { id, minTier: Number(event.target.value) } : { id })}
          aria-label={t('explorer.tierLabel', { name })}
        >
          <option value="">{t('explorer.anyActive')}</option>
          {traitBreakpoints(meta).map(({ tier, minUnits }) => (
            <option key={tier} value={tier}>{t('explorer.atLeastUnits', { count: minUnits })}</option>
          ))}
        </select>
      )}

      {kind === 'item' && <span className={styles.chipNote}>{t('explorer.onAnyUnit')}</span>}

      <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={t('explorer.removeFilter', { name })}>
        ✕
      </button>
    </li>
  )
}
