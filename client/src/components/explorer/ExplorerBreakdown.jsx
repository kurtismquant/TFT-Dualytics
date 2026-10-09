import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAvg, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor } from '../../utils/statsQuality.js'
import { getTraitTierInfo } from '../../utils/traitTier.js'
import styles from './DataExplorer.module.css'

const VISIBLE_ROWS = 12
const SORTS = {
  played: (a, b) => b.count - a.count || a.avgPlacement - b.avgPlacement,
  best: (a, b) => a.avgPlacement - b.avgPlacement || b.count - a.count,
}

function rowLabel(kind, row, meta) {
  if (kind !== 'trait') return meta?.name || row.id
  const { minUnits } = getTraitTierInfo(meta, row.tier)
  const name = meta?.name || row.id
  return minUnits != null ? `${minUnits} ${name}` : name
}

function Panel({ kind, rows, lookups, minGames, onAdd }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState('played')
  const [expanded, setExpanded] = useState(false)
  const sorted = rows.slice().sort(SORTS[sort])
  const shown = expanded ? sorted : sorted.slice(0, VISIBLE_ROWS)

  return (
    <section className={styles.panel} aria-label={t(`explorer.panel.${kind}`)}>
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t(`explorer.panel.${kind}`)}</h3>
        <div className={styles.sortToggle} role="group" aria-label={t('explorer.sortLabel')}>
          {Object.keys(SORTS).map(key => (
            <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>
              {t(`explorer.sort.${key}`)}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0
        ? <p className={styles.panelEmpty}>{t('explorer.panelEmpty', { count: minGames })}</p>
        : (
          <table className={styles.breakdown}>
            <thead>
              <tr>
                <th scope="col">{t(`explorer.col.${kind}`)}</th>
                <th scope="col">{t('explorer.col.playRate')}</th>
                <th scope="col">{t('explorer.col.avg')}</th>
                <th scope="col">{t('explorer.col.delta')}</th>
                <th scope="col"><span className="sr-only">{t('explorer.col.add')}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(row => {
                const meta = lookups[kind].get(row.id)
                const label = rowLabel(kind, row, meta)
                return (
                  <tr key={`${row.id}#${row.tier ?? ''}`}>
                    <th scope="row">
                      <span className={styles.rowName}>
                        {meta?.iconUrl && <img src={meta.iconUrl} alt="" className={styles.rowIcon} />}
                        <span>{label}</span>
                      </span>
                    </th>
                    <td>
                      {formatPercent(row.frequency)}
                      <span className={styles.rowGames}>{row.count.toLocaleString()}</span>
                    </td>
                    <td className={styles.colored} style={{ '--metric-color': getAvgPlacementColor(row.avgPlacement) }}>
                      {formatAvg(row.avgPlacement)}
                    </td>
                    <td className={row.delta <= 0 ? styles.deltaGood : styles.deltaBad}>
                      {row.delta <= 0 ? '−' : '+'}{Math.abs(row.delta).toFixed(2)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.addButton}
                        onClick={() => onAdd(kind, row.id, kind === 'trait' ? { minTier: row.tier } : {})}
                        aria-label={t('explorer.addFilter', { name: label })}
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      {sorted.length > VISIBLE_ROWS && (
        <button type="button" className={styles.showMore} onClick={() => setExpanded(v => !v)}>
          {expanded ? t('explorer.showLess') : t('explorer.showAll', { count: sorted.length })}
        </button>
      )}
    </section>
  )
}

// What the matching boards run (filters excluded), each with its results inside
// those boards. Δ is avg placement minus the matching boards' avg: negative =
// boards with it do better.
export default function ExplorerBreakdown({ data, lookups, onAdd }) {
  if (!data.boards) return null
  return (
    <div className={styles.panels}>
      {['unit', 'trait', 'item'].map(kind => (
        <Panel key={kind} kind={kind} rows={data[`${kind}s`] || []} lookups={lookups} minGames={data.minGames} onAdd={onAdd} />
      ))}
    </div>
  )
}
