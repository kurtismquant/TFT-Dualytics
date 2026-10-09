import { useTranslation } from 'react-i18next'
import ExplorerTable from './ExplorerTable.jsx'
import ExplorerItemsView from './ExplorerItemsView.jsx'
import ExplorerCompsView from './ExplorerCompsView.jsx'
import { getTraitTierInfo } from '../../utils/traitTier.js'
import { EXPLORER_VIEWS } from '../../utils/explorerParams.js'
import navStyles from '../unit-stats/UnitStatsNav.module.css'
import styles from './DataExplorer.module.css'

function traitLabel(row, meta) {
  const name = meta?.name || row.id
  const { minUnits } = getTraitTierInfo(meta, row.tier)
  return minUnits != null ? `${minUnits} ${name}` : name
}

// Units / traits tables: what the matching boards run besides the filters.
function SimpleView({ kind, data, lookups, onAdd }) {
  const { t } = useTranslation()
  const label = (row, meta) => (kind === 'trait' ? traitLabel(row, meta) : meta?.name || row.id)
  return (
    <ExplorerTable
      label={t(`explorer.panel.${kind}`)}
      nameHeader={t(`explorer.col.${kind}`)}
      rows={data[`${kind}s`] || []}
      minGames={data.minGames}
      getKey={row => `${row.id}#${row.tier ?? ''}`}
      renderName={row => {
        const meta = lookups[kind].get(row.id)
        return (
          <>
            {meta?.iconUrl && <img src={meta.iconUrl} alt="" className={styles.rowIcon} />}
            <span>{label(row, meta)}</span>
          </>
        )
      }}
      onAdd={row => onAdd(kind, row.id, kind === 'trait' ? { minTier: row.tier } : {})}
      addLabel={row => t('explorer.addFilter', { name: label(row, lookups[kind].get(row.id)) })}
    />
  )
}

// Horizontal view nav + the selected breakdown of the matching boards.
export default function ExplorerBreakdown({
  view, setView, data, lookups, champions, items, traits, filteredUnitIds, onAdd, onAddUnitItem,
}) {
  const { t } = useTranslation()
  if (!data.boards) return null
  return (
    <>
      <nav className={`${navStyles.nav} ${styles.viewNav}`} aria-label={t('explorer.viewNav')}>
        {EXPLORER_VIEWS.map(key => (
          <button
            key={key}
            type="button"
            className={`${navStyles.link} ${styles.viewNavButton}`}
            aria-current={view === key ? 'true' : undefined}
            onClick={() => setView(key)}
          >
            {t(`explorer.view.${key}`)}
          </button>
        ))}
      </nav>
      {view === 'units' && <SimpleView kind="unit" data={data} lookups={lookups} onAdd={onAdd} />}
      {view === 'traits' && <SimpleView kind="trait" data={data} lookups={lookups} onAdd={onAdd} />}
      {view === 'items' && (
        <ExplorerItemsView
          data={data}
          lookups={lookups}
          filteredUnitIds={filteredUnitIds}
          onAddItem={id => onAdd('item', id)}
          onAddUnitItem={onAddUnitItem}
        />
      )}
      {view === 'comps' && <ExplorerCompsView data={data} champions={champions} items={items} traits={traits} />}
    </>
  )
}
