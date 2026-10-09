import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAvg, formatDelta, formatPercent } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor, getWinRateColor } from '../../utils/statsQuality.js'
import { EXPLORER_SORTS } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

// Green when boards with it place better, red when worse, plain when ~equal.
function deltaClass(delta) {
  if (formatDelta(delta) === '0.00') return undefined
  return delta < 0 ? styles.deltaGood : styles.deltaBad
}

export function SortToggle({ sort, setSort }) {
  const { t } = useTranslation()
  return (
    <div className={styles.sortToggle} role="group" aria-label={t('explorer.sortLabel')}>
      {Object.keys(EXPLORER_SORTS).map(key => (
        <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>
          {t(`explorer.sort.${key}`)}
        </button>
      ))}
    </div>
  )
}

// Rows sorted within each group; groups keep the order they first appear in.
function arrange(rows, sort, groupOf) {
  if (!groupOf) return [{ key: null, rows: rows.slice().sort(EXPLORER_SORTS[sort]) }]
  const groups = new Map()
  for (const row of rows) {
    const key = groupOf(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups].map(([key, list]) => ({ key, rows: list.sort(EXPLORER_SORTS[sort]) }))
}

// One scrollable breakdown table listing every row the server returned (each
// has at least `minGames` boards). `renderName(row)` → the name cell content;
// `groupOf` + `renderGroup` split the rows under group headings.
export default function ExplorerTable({
  label, nameHeader, rows, getKey, renderName, onAdd, addLabel, groupOf, renderGroup, minGames, controls,
}) {
  const { t } = useTranslation()
  const [sort, setSort] = useState('played')
  const groups = useMemo(() => arrange(rows, sort, groupOf), [rows, sort, groupOf])

  return (
    <section className={styles.panel} aria-label={label}>
      <header className={styles.panelHeader}>
        <div className={styles.panelControls}>{controls}</div>
        <SortToggle sort={sort} setSort={setSort} />
      </header>
      {rows.length === 0
        ? <p className={styles.panelEmpty}>{t('explorer.panelEmpty', { count: minGames })}</p>
        : (
          // Focusable so keyboard users can scroll it (it holds no other focus targets but the + buttons).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t('explorer.tableScroll', { label })}>
            <table className={styles.breakdown}>
              <thead>
                <tr>
                  <th scope="col">{nameHeader}</th>
                  <th scope="col">{t('explorer.col.playRate')}</th>
                  <th scope="col">{t('explorer.col.avg')}</th>
                  <th scope="col" className={styles.optionalCol}>{t('explorer.col.win')}</th>
                  <th scope="col" className={styles.optionalCol}>{t('explorer.col.top2')}</th>
                  <th scope="col">{t('explorer.col.delta')}</th>
                  <th scope="col"><span className="sr-only">{t('explorer.col.add')}</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <Fragment key={group.key ?? 'all'}>
                    {group.key != null && (
                      <tr className={styles.groupRow}>
                        <th scope="colgroup" colSpan={7}>{renderGroup(group.key, group.rows)}</th>
                      </tr>
                    )}
                    {group.rows.map(row => (
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
                        <td className={deltaClass(row.delta)}>
                          {formatDelta(row.delta)}
                        </td>
                        <td>
                          <button type="button" className={styles.addButton} onClick={() => onAdd(row)} aria-label={addLabel(row)}>
                            +
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
