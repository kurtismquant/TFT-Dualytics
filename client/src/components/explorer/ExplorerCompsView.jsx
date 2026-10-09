import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CompRowHeader from '../comp-row/CompRowHeader.jsx'
import CompUnitList from '../comp-row/CompUnitList.jsx'
import { SortButtons } from './ExplorerTable.jsx'
import { useExplorerSort } from '../../hooks/useExplorerSort.js'
import { resolveUnits } from '../../utils/resolveUnits.js'
import { formatDelta } from '../../utils/statsFormatting.js'
import { generateCompName, getUniqueTraitIds } from '../../utils/compName.js'
import { buildUnitPath } from '../../constants/routes.js'
import compRowStyles from '../CompRow.module.css'
import compStyles from '../../pages/CompPage.module.css'
import styles from './DataExplorer.module.css'

function ExplorerCompRow({ row, totalGames, champions, items, traits, uniqueTraitIds }) {
  const { t } = useTranslation()
  const resolvedUnits = useMemo(() => resolveUnits(row.units, champions, items), [row.units, champions, items])
  const name = useMemo(
    () => generateCompName(row, { champions, traits, uniqueTraitIds }),
    [row, champions, traits, uniqueTraitIds]
  )
  return (
    <div className={compRowStyles.row}>
      <CompRowHeader name={name} comp={row} traits={traits} champions={champions} excludeTraitIds={uniqueTraitIds} />
      <div className={styles.compBody}>
        <CompUnitList
          resolvedUnits={resolvedUnits}
          items={items}
          // Times played per game on the patch, as on the Comps page.
          playRate={totalGames > 0 ? row.count / totalGames : 0}
          winRate={row.winRate}
          avgPlacement={row.avgPlacement}
          getUnitHref={id => buildUnitPath(id)}
        />
        <span
          className={`${styles.compDelta} ${formatDelta(row.delta) === '0.00' ? '' : row.delta < 0 ? styles.deltaGood : styles.deltaBad}`}
          title={t('explorer.note.boards')}
        >
          {t('explorer.col.delta')} {formatDelta(row.delta)}
          <span className={styles.rowGames}>{t('explorer.boardCount', { count: row.count, formatted: row.count.toLocaleString() })}</span>
        </span>
      </div>
    </div>
  )
}

// Comps the matching boards were playing (as grouped on the Comps page),
// rated within those boards.
export default function ExplorerCompsView({ data, champions, items, traits }) {
  const { t } = useTranslation()
  const uniqueTraitIds = useMemo(() => getUniqueTraitIds(champions || [], traits || []), [champions, traits])
  const comps = useMemo(() => data.comps || [], [data.comps])
  const { sort, sorted: rows, onSort } = useExplorerSort(comps)

  return (
    <section className={styles.panel} aria-label={t('explorer.panel.comp')}>
      <header className={styles.panelHeader}>
        <p className={styles.viewNote}>{t('explorer.note.comps')}</p>
        <SortButtons sort={sort} onSort={onSort} />
      </header>
      {rows.length === 0
        ? <p className={styles.panelEmpty}>{t('explorer.panelEmpty', { count: data.minGames })}</p>
        : (
          // Focusable so keyboard users can scroll the list.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className={`${styles.tableScroll} ${styles.compScroll}`} tabIndex={0} role="region"
            aria-label={t('explorer.tableScroll', { label: t('explorer.panel.comp') })}>
            <div className={compStyles.compList}>
              {rows.map(row => (
                <ExplorerCompRow
                  key={row.id}
                  row={row}
                  totalGames={data.totalGames}
                  champions={champions || []}
                  items={items || []}
                  traits={traits || []}
                  uniqueTraitIds={uniqueTraitIds}
                />
              ))}
            </div>
          </div>
        )}
    </section>
  )
}
