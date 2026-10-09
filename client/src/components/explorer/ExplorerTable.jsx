import { useTranslation } from 'react-i18next'
import SortHeader from '../stats/SortHeader.jsx'
import { useExplorerSort } from '../../hooks/useExplorerSort.js'
import { formatAvg, formatDelta, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor, getWinRateColor } from '../../utils/statsQuality.js'
import { EXPLORER_SORT_KEYS } from '../../utils/explorerSort.js'
import styles from './DataExplorer.module.css'

// Column labels, by sort key.
const COLUMN_LABEL_KEYS = {
  count: 'explorer.col.playRate',
  avgPlacement: 'explorer.col.avg',
  winRate: 'explorer.col.win',
  top2Rate: 'explorer.col.top2',
  delta: 'explorer.col.delta',
}
// Hidden on phones.
const OPTIONAL_COLUMNS = new Set(['winRate', 'top2Rate'])

// Green when boards with it place better, red when worse, plain when ~equal.
function deltaClass(delta) {
  if (formatDelta(delta) === '0.00') return undefined
  return delta < 0 ? styles.deltaGood : styles.deltaBad
}

// Sort buttons for lists that aren't tables (the comps view).
export function SortButtons({ sort, onSort }) {
  const { t } = useTranslation()
  return (
    <div className={styles.sortToggle} role="group" aria-label={t('explorer.sortLabel')}>
      {EXPLORER_SORT_KEYS.map(key => (
        <button key={key} type="button" aria-pressed={sort.key === key} onClick={() => onSort(key)}>
          {t(COLUMN_LABEL_KEYS[key])}
          {sort.key === key && <span aria-hidden="true"> {sort.direction === 'asc' ? '▲' : '▼'}</span>}
        </button>
      ))}
    </div>
  )
}

// One scrollable breakdown table listing every row the server returned (each
// has at least `minGames` boards), sortable by any stat column; Play sorts by
// times played. `renderName(row)` → the name cell content.
export default function ExplorerTable({ label, nameHeader, rows, getKey, renderName, onAdd, addLabel, minGames, controls }) {
  const { t } = useTranslation()
  const { sort, sorted, onSort } = useExplorerSort(rows)

  return (
    <section className={styles.panel} aria-label={label}>
      {controls && <header className={styles.panelHeader}>{controls}</header>}
      {rows.length === 0
        ? <p className={styles.panelEmpty}>{t('explorer.panelEmpty', { count: minGames })}</p>
        : (
          // Focusable so keyboard users can scroll it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t('explorer.tableScroll', { label })}>
            <table className={styles.breakdown}>
              <thead>
                <tr>
                  <th scope="col">{nameHeader}</th>
                  {EXPLORER_SORT_KEYS.map(key => (
                    <SortHeader
                      key={key}
                      columnKey={key}
                      label={t(COLUMN_LABEL_KEYS[key])}
                      sort={sort}
                      onSort={onSort}
                      className={OPTIONAL_COLUMNS.has(key) ? styles.optionalCol : undefined}
                    />
                  ))}
                  <th scope="col"><span className="sr-only">{t('explorer.col.add')}</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={getKey(row)}>
                    <th scope="row"><span className={styles.rowName}>{renderName(row)}</span></th>
                    <td>
                      {formatPercent(row.frequency)}
                      <span className={styles.rowGames}>{row.count.toLocaleString()}</span>
                    </td>
                    <td className={styles.colored} style={{ '--metric-color': getAvgPlacementColor(row.avgPlacement) }}>
                      {formatAvg(row.avgPlacement)}
                    </td>
                    <td className={`${styles.colored} ${styles.optionalCol}`} style={{ '--metric-color': getWinRateColor(row.winRate) }}>
                      {formatPercent(row.winRate)}
                    </td>
                    <td className={styles.optionalCol}>{formatPercent(row.top2Rate)}</td>
                    <td className={deltaClass(row.delta)}>{formatDelta(row.delta)}</td>
                    <td>
                      <button type="button" className={styles.addButton} onClick={() => onAdd(row)} aria-label={addLabel(row)}>
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
