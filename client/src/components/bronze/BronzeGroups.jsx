import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import BronzeCompRow from './BronzeCompRow.jsx'
import Chevron from './Chevron.jsx'
import styles from './BronzeComps.module.css'

// The result list, one section per trait count (from pageGroups). Each heading
// is a toggle: collapsing hides that count's comps so the next tier moves up.
// `rowProps` are passed to every BronzeCompRow; `highlyPlayed` maps comp key
// to its play count for the star.
export default function BronzeGroups({ groups, onToggle, rowProps, highlyPlayed }) {
  const { t } = useTranslation()
  const baseId = useId()
  return groups.map(group => {
    const listId = `${baseId}-${group.traitCount}`
    return (
      <section key={group.traitCount} className={styles.group}>
        <h3 className={styles.groupHeading}>
          <button
            type="button"
            className={styles.groupToggle}
            onClick={() => onToggle(group.traitCount)}
            aria-expanded={!group.collapsed}
            aria-controls={group.collapsed ? undefined : listId}
          >
            <Chevron direction={group.collapsed ? 'right' : 'down'} size={18} className={styles.groupChevron} />
            <span>{t('bronze.groupHeading', { count: group.traitCount })}</span>
          </button>
          {group.collapsed && <span className={styles.groupHidden}>{t('bronze.groupHidden', { count: group.total })}</span>}
        </h3>
        {!group.collapsed && (
          <ol id={listId} className={styles.groupList}>
            {group.comps.map(comp => (
              <BronzeCompRow key={comp.key} comp={comp} {...rowProps} played={highlyPlayed.get(comp.key)} />
            ))}
          </ol>
        )}
      </section>
    )
  })
}
