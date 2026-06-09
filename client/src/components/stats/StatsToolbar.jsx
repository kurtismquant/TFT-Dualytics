import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import styles from '../../pages/StatsPage.module.css'

const COSTS = [1, 2, 3, 4, 5]
const ITEM_CATEGORIES = ['craftable', 'radiant', 'artifact', 'emblem', 'other']

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export default function StatsToolbar({
  activeTab,
  setActiveTab,
  patch,
  patches,
  setPatch,
  query,
  setQuery,
  costFilter,
  setCostFilter,
  itemCategory,
  setItemCategory,
}) {
  const { t } = useTranslation()
  const patchHelpId = 'stats-patch-help'
  const searchHelpId = 'stats-search-help'

  // Tab labels depend on the active translation, so this must rebuild when
  // language changes — but it should be stable across unrelated state.
  const tabs = useMemo(() => ([
    { key: 'units', label: t('stats.tabUnits') },
    { key: 'items', label: t('stats.tabItems') },
    { key: 'traits', label: t('stats.tabTraits') },
  ]), [t])

  const handlePatchChange = useCallback(event => setPatch(event.target.value), [setPatch])
  const handleQueryChange = useCallback(event => setQuery(event.target.value), [setQuery])
  const handleToggleCost = useCallback(
    cost => setCostFilter(current => current === cost ? null : cost),
    [setCostFilter],
  )

  return (
    <>
      <p id={patchHelpId} className="sr-only">{t('stats.patchHelp')}</p>
      <p id={searchHelpId} className="sr-only">{t('stats.searchHelp')}</p>
      <div className={styles.primaryControls}>
        <select
          className={styles.select}
          value={patch || ''}
          onChange={handlePatchChange}
          aria-label={t('stats.patchLabel')}
          aria-describedby={patchHelpId}
        >
          {patches.length === 0 && <option value="">{t('stats.noPatch')}</option>}
          {patches.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {(activeTab === 'units' || activeTab === 'items') && (
          <div className={styles.costFilters} role="group" aria-label={t('stats.typeFilterLabel')}>
            <span className={styles.costLabel}>{activeTab === 'units' ? t('stats.costLabel') : t('stats.typeLabel')}</span>
            {activeTab === 'units'
              ? COSTS.map(cost => (
                  <button
                    key={cost}
                    className={`${styles.costButton} ${costFilter === cost ? styles.costActive : ''}`}
                    style={{ '--cost-color': `var(--cost-${cost})` }}
                    type="button"
                    onClick={() => handleToggleCost(cost)}
                    aria-pressed={costFilter === cost}
                  >
                    {cost}
                  </button>
                ))
              : ITEM_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`${styles.costButton} ${styles.itemButton} ${itemCategory === cat ? styles.costActive : ''}`}
                    style={{ '--cost-color': 'var(--cost-1)' }}
                    type="button"
                    onClick={() => setItemCategory(cat)}
                    aria-pressed={itemCategory === cat}
                  >
                    {t(`filterBar.cat${capitalize(cat)}`)}
                  </button>
                ))
            }
          </div>
        )}
        <input
          className={styles.search}
          type="search"
          placeholder={t('stats.searchPlaceholder')}
          value={query}
          onChange={handleQueryChange}
          aria-label={t('stats.searchLabel')}
          aria-describedby={searchHelpId}
        />
      </div>
      <div className={styles.tabBar} role="group" aria-label={t('stats.statsTypeLabel')}>
        {tabs.map(tab => (
          <Button
            key={tab.key}
            variant="tab"
            pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </>
  )
}
