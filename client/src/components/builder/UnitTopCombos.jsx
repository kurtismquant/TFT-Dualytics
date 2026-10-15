import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useUnitItemCombos } from '../../hooks/useUnitItemCombos.js'
import { useBoardStore } from '../../store/boardStore.js'
import { HoverableItem } from '../shared/HoverableBoardPieces.jsx'
import { buildItemLookup } from '../../utils/itemComboFilter.js'
import { formatAvg } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor } from '../../utils/statsQuality.js'
import styles from './UnitInspector.module.css'

const TOP_COMBOS = 3

// Same items in any order (combos and cells can repeat an item).
const sameItems = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

// A unit's most-played 3-item combos this patch, each with an Equip button that
// puts the combo on the inspected board unit (replacing its items). The server
// sorts combos by avg placement, so they are re-sorted by games here.
export default function UnitTopCombos({ unitId, cellId, cellItems, allItems }) {
  const { t } = useTranslation()
  const setCellItems = useBoardStore(s => s.setCellItems)
  const { data, isLoading, isError } = useUnitItemCombos({ unitId })
  const itemLookup = useMemo(() => buildItemLookup(allItems), [allItems])
  const combos = useMemo(
    () => [...(data?.combos || [])].sort((a, b) => b.count - a.count).slice(0, TOP_COMBOS),
    [data],
  )

  let body
  if (isLoading) body = <p className={styles.note}>{t('builder.inspector.loadingCombos')}</p>
  else if (isError) body = <p className={styles.note}>{t('builder.inspector.combosError')}</p>
  else if (!combos.length) body = <p className={styles.note}>{t('unit.notEnoughData')}</p>
  else {
    body = (
      <ol className={styles.combos}>
        {combos.map(combo => {
          // Board cells hold catalog ids; combos name items by apiName.
          const itemIds = combo.items.map(id => itemLookup.get(id)?.id).filter(Boolean)
          const equipped = sameItems(itemIds, cellItems)
          const names = combo.items.map(id => itemLookup.get(id)?.name || id).join(', ')
          return (
            <li key={combo.items.join('|')} className={styles.combo}>
              <div className={styles.comboItems}>
                {combo.items.map((id, i) => {
                  const item = itemLookup.get(id)
                  return item
                    ? <HoverableItem key={i} item={item} allItems={allItems} size={28} />
                    : <span key={i} className={styles.missingItem} title={id} aria-hidden="true">?</span>
                })}
                <span className="sr-only">{names}</span>
              </div>
              <div className={styles.comboStats}>
                <span
                  className={styles.comboAvg}
                  style={{ color: getAvgPlacementColor(combo.avgPlacement) }}
                  aria-label={`${t('stats.colAvgPlace')}: ${formatAvg(combo.avgPlacement)}`}
                >
                  {formatAvg(combo.avgPlacement)}
                </span>
                <span className={styles.comboGames}>
                  {t('builder.inspector.games', { count: combo.count, formatted: combo.count.toLocaleString() })}
                </span>
              </div>
              <button
                type="button"
                className={styles.equip}
                aria-pressed={equipped}
                aria-label={t('builder.inspector.equipLabel', { items: names })}
                disabled={itemIds.length !== combo.items.length}
                onClick={() => setCellItems(cellId, itemIds)}
              >
                {t(equipped ? 'builder.inspector.equipped' : 'builder.inspector.equip')}
              </button>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <section className={styles.section} aria-labelledby="unit-inspector-combos">
      <h3 id="unit-inspector-combos" className={styles.sectionTitle}>{t('builder.inspector.topCombos')}</h3>
      {body}
    </section>
  )
}
