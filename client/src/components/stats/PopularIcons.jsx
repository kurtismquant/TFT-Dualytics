import styles from '../../pages/StatsPage.module.css'
import HoverablePopularIcon from './HoverablePopularIcon.jsx'

export default function PopularIcons({ entries, map, emptyLabel, popularCardType, allItems }) {
  if (!entries?.length) return <span className={styles.muted}>{emptyLabel}</span>
  return (
    <div className={styles.popularIcons}>
      {entries.map(entry => (
        <HoverablePopularIcon
          key={entry.id}
          entry={entry}
          meta={map.get(entry.id)}
          cardType={popularCardType}
          allItems={allItems}
        />
      ))}
    </div>
  )
}
