import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExplorerTable from './ExplorerTable.jsx'
import ExplorerUnitPicker from './ExplorerUnitPicker.jsx'
import { ANY_UNIT } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

function Icon({ meta }) {
  return meta?.iconUrl ? <img src={meta.iconUrl} alt="" className={styles.rowIcon} /> : <span className={styles.rowIcon} />
}

// Items on the matching boards: on any unit, split by the unit holding them
// (one row per item + unit, rated like the overall list), or on one chosen
// unit (rated within that unit's boards).
export default function ExplorerItemsView({ data, lookups, filteredUnitIds, onAddItem, onAddUnitItem }) {
  const { t } = useTranslation()
  const [unitId, setUnitId] = useState(ANY_UNIT)
  const [byUnit, setByUnit] = useState(false)
  const unitItems = useMemo(() => data.unitItems || [], [data.unitItems])
  const filteredIds = useMemo(() => new Set(filteredUnitIds), [filteredUnitIds])

  // Units holding any listed item (plus the filtered ones), most played first.
  const units = useMemo(() => {
    const counts = new Map(filteredUnitIds.map(id => [id, null]))
    for (const row of unitItems) counts.set(row.unit, row.unitCount)
    return [...counts].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([id, count]) => ({ id, count }))
  }, [unitItems, filteredUnitIds])
  const selected = units.some(unit => unit.id === unitId) ? unitId : ANY_UNIT

  const rows = useMemo(() => {
    if (selected !== ANY_UNIT) return unitItems.filter(row => row.unit === selected)
    if (!byUnit) return data.items || []
    // Split rows read like the overall list: share of all matching boards, delta vs their avg.
    return unitItems.map(row => ({
      ...row,
      frequency: data.boards ? row.count / data.boards : 0,
      delta: row.avgPlacement - data.avgPlacement,
    }))
  }, [selected, byUnit, unitItems, data.items, data.boards, data.avgPlacement])

  const nameOf = (kind, id) => lookups[kind].get(id)?.name || id
  const showUnitIcon = selected === ANY_UNIT && byUnit

  const controls = (
    <>
      <ExplorerUnitPicker
        units={units}
        filteredIds={filteredIds}
        selected={selected}
        onSelect={setUnitId}
        lookups={lookups}
      />
      {selected === ANY_UNIT && (
        <button type="button" className={styles.toggleButton} aria-pressed={byUnit} onClick={() => setByUnit(v => !v)}>
          {t('explorer.groupByUnit')}
        </button>
      )}
    </>
  )

  return (
    <>
      <ExplorerTable
        label={t('explorer.panel.item')}
        nameHeader={t('explorer.col.item')}
        rows={rows}
        minGames={data.minGames}
        controls={controls}
        getKey={row => `${row.unit ?? ''}|${row.id}`}
        renderName={row => (
          <>
            <span className={styles.iconPair}>
              <Icon meta={lookups.item.get(row.id)} />
              {showUnitIcon && <Icon meta={lookups.unit.get(row.unit)} />}
            </span>
            <span>
              {nameOf('item', row.id)}
              {row.unit && <span className="sr-only"> {t('explorer.onUnit', { name: nameOf('unit', row.unit) })}</span>}
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
