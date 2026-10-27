import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CompRowHeader from '../comp-row/CompRowHeader.jsx'
import CompUnitList from '../comp-row/CompUnitList.jsx'
import { SortButtons } from './ExplorerTable.jsx'
import { useExplorerSort } from '../../hooks/useExplorerSort.js'
import { resolveUnits } from '../../utils/resolveUnits.js'
import { EXPLORER_SORT_KEYS } from '../../utils/explorerSort.js'
import { generateCompName, getUniqueTraitIds } from '../../utils/compName.js'
import { buildUnitPath } from '../../constants/routes.js'
import { teamCodeForResolvedUnits } from '../../utils/teamPlannerCode.js'
import compRowStyles from '../CompRow.module.css'
import compStyles from '../../pages/CompPage.module.css'
import styles from './DataExplorer.module.css'

// The comp rows don't show a delta, so they don't sort by one.
const COMP_SORT_KEYS = EXPLORER_SORT_KEYS.filter(key => key !== 'delta')

function ExplorerCompRow({ row, totalGames, champions, items, traits, uniqueTraitIds }) {
  const { t } = useTranslation()
  const resolvedUnits = useMemo(() => resolveUnits(row.units, champions, items), [row.units, champions, items])
  const name = useMemo(
    () => generateCompName(row, { champions, traits, uniqueTraitIds }),
    [row, champions, traits, uniqueTraitIds]
  )
  return (
    <div className={compRowStyles.row}>
      <CompRowHeader
        name={name}
        comp={row}
        traits={traits}
        champions={champions}
        excludeTraitIds={uniqueTraitIds}
        teamCode={teamCodeForResolvedUnits(resolvedUnits)}
      />
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
        <span className={`${styles.rowGames} ${styles.compGames}`}>
          {t('explorer.boardCount', { count: row.count, formatted: row.count.toLocaleString() })}
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
        <SortButtons sort={sort} onSort={onSort} keys={COMP_SORT_KEYS} />
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
