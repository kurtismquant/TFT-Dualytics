import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExplorerTable from './ExplorerTable.jsx'
import styles from './DataExplorer.module.css'

const ANY_UNIT = ''

// Item icon with the holder's champion icon tucked into its bottom-right corner.
function ItemOnUnit({ item, unit }) {
  return (
    <span className={styles.iconStack}>
      {item?.iconUrl ? <img src={item.iconUrl} alt="" className={styles.rowIcon} /> : <span className={styles.rowIcon} />}
      {unit?.iconUrl && <img src={unit.iconUrl} alt="" className={styles.unitBadge} />}
    </span>
  )
}

// Items on the matching boards: on any unit, split by the unit holding them
// (one row per item + unit, rated like the overall list), or on one chosen
// unit (rated within that unit's boards).
export default function ExplorerItemsView({ data, lookups, onAddItem, onAddUnitItem }) {
  const { t } = useTranslation()
  const [unitId, setUnitId] = useState(ANY_UNIT)
  const [byUnit, setByUnit] = useState(false)
  const unitItems = useMemo(() => data.unitItems || [], [data.unitItems])

  // Units holding any listed item, most played first.
  const units = useMemo(() => {
    const counts = new Map()
    for (const row of unitItems) counts.set(row.unit, row.unitCount)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }))
  }, [unitItems])
  const selected = units.some(unit => unit.id === unitId) ? unitId : ANY_UNIT
  const perUnit = selected !== ANY_UNIT

  const rows = useMemo(() => {
    if (selected !== ANY_UNIT) return unitItems.filter(row => row.unit === selected)
    if (!byUnit) return data.items || []
    // Split rows read like the overall list: share of all matching boards, Δ vs their avg.
    return unitItems.map(row => ({
      ...row,
      frequency: data.boards ? row.count / data.boards : 0,
      delta: row.avgPlacement - data.avgPlacement,
    }))
  }, [selected, byUnit, unitItems, data.items, data.boards, data.avgPlacement])

  const nameOf = (kind, id) => lookups[kind].get(id)?.name || id

  const controls = (
    <>
      <label className={styles.controlLabel}>
        <span>{t('explorer.itemsOn')}</span>
        {selected !== ANY_UNIT && lookups.unit.get(selected)?.iconUrl && (
          <img src={lookups.unit.get(selected).iconUrl} alt="" className={styles.rowIcon} />
        )}
        <select className={styles.chipSelect} value={selected} onChange={event => setUnitId(event.target.value)}>
          <option value={ANY_UNIT}>{t('explorer.anyUnit')}</option>
          {units.map(unit => <option key={unit.id} value={unit.id}>{nameOf('unit', unit.id)}</option>)}
        </select>
      </label>
      {selected === ANY_UNIT && (
        <button type="button" className={styles.toggleButton} aria-pressed={byUnit} onClick={() => setByUnit(v => !v)}>
          {t('explorer.groupByUnit')}
        </button>
      )}
    </>
  )

  return (
    <>
      <p className={styles.viewNote}>
        {perUnit ? t('explorer.note.unitItems') : t('explorer.note.boards')}
      </p>
      <ExplorerTable
        label={t('explorer.panel.item')}
        nameHeader={t('explorer.col.item')}
        rows={rows}
        minGames={data.minGames}
        controls={controls}
        getKey={row => `${row.unit ?? ''}|${row.id}`}
        renderName={row => (
          <>
            {row.unit
              ? <ItemOnUnit item={lookups.item.get(row.id)} unit={lookups.unit.get(row.unit)} />
              : lookups.item.get(row.id)?.iconUrl && <img src={lookups.item.get(row.id).iconUrl} alt="" className={styles.rowIcon} />}
            <span>
              {nameOf('item', row.id)}
              {row.unit && (
                <span className={selected === ANY_UNIT ? styles.rowGames : 'sr-only'}>
                  {' '}{t('explorer.onUnit', { name: nameOf('unit', row.unit) })}
                </span>
              )}
            </span>
          </>
        )}
        onAdd={row => (row.unit ? onAddUnitItem(row.unit, row.id) : onAddItem(row.id))}
        addLabel={row => (row.unit
          ? t('explorer.addUnitItem', { item: nameOf('item', row.id), name: nameOf('unit', row.unit) })
          : t('explorer.addFilter', { name: nameOf('item', row.id) }))}
      />
    </>
  )
}
