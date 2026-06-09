import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './ui/Button.jsx'
import SearchInput from './ui/SearchInput.jsx'
import styles from './FilterBar.module.css'

const FilterBar = forwardRef(function FilterBar({
  search,
  onSearchChange,
  champSort,
  onChampSortChange,
  itemCategory,
  onItemCategoryChange,
}, searchInputRef) {
  const { t } = useTranslation()
  const shortcutId = 'builder-filter-shortcut'

  const CHAMP_SORTS = [
    { id: 'cost', label: t('filterBar.sortCost') },
    { id: 'name', label: t('filterBar.sortName') },
    { id: 'origin', label: t('filterBar.sortOrigin') },
    { id: 'class', label: t('filterBar.sortClass') },
  ]

  const ITEM_CATEGORIES = [
    { id: 'craftable', label: t('filterBar.catCraftable') },
    { id: 'radiant', label: t('filterBar.catRadiant') },
    { id: 'artifact', label: t('filterBar.catArtifact') },
    { id: 'emblem', label: t('filterBar.catEmblem') },
    { id: 'other', label: t('filterBar.catOther') },
  ]

  return (
    <div className={styles.bar}>
      <SearchInput
        ref={searchInputRef}
        className={styles.searchWrap}
        placeholder={t('filterBar.searchPlaceholder')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label={t('filterBar.searchPlaceholder')}
        aria-describedby={shortcutId}
        hint={t('filterBar.shortcut')}
        hintId={shortcutId}
      />

      <div className={styles.tabGroup}>
        {CHAMP_SORTS.map(s => (
          <Button
            key={s.id}
            variant="tab"
            pressed={champSort === s.id}
            onClick={() => onChampSortChange(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className={styles.tabGroup}>
        {ITEM_CATEGORIES.map(c => (
          <Button
            key={c.id}
            variant="tab"
            pressed={itemCategory === c.id}
            onClick={() => onItemCategoryChange(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  )
})

export default FilterBar
