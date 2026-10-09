import { useTranslation } from 'react-i18next'
import { getTraitTierInfo } from '../../utils/traitTier.js'
import { MAX_UNIT_ITEMS } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

// Star choices for a unit filter → { minStar, maxStar }.
const STAR_OPTIONS = {
  any: {},
  1: { minStar: 1, maxStar: 1 },
  2: { minStar: 2, maxStar: 2 },
  3: { minStar: 3, maxStar: 3 },
  '2+': { minStar: 2 },
}

function starKey({ minStar, maxStar }) {
  if (!minStar && !maxStar) return 'any'
  if (minStar && minStar === maxStar) return String(minStar)
  return '2+'
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
          <select
            className={styles.chipSelect}
            value={starKey(entry)}
            onChange={event => onChange({ id: entry.id, items: entry.items, ...STAR_OPTIONS[event.target.value] })}
            aria-label={t('explorer.starLabel', { name })}
          >
            {Object.keys(STAR_OPTIONS).map(key => (
              <option key={key} value={key}>{t(`explorer.stars.${key === '2+' ? 'twoPlus' : key}`)}</option>
            ))}
          </select>
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
              className={styles.chipSelect}
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
