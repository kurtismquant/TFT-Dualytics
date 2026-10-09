import ItemIcon from './ItemIcon.jsx'
import StatIcon from './StatIcon.jsx'
import DetailCardShell from './shared/DetailCardShell.jsx'
import ItemDescription from './shared/ItemDescription.jsx'
import ItemStatsSheetLink from './shared/ItemStatsSheetLink.jsx'
import { itemComponents, visibleItemStats } from '../utils/itemStats.js'
import styles from './ItemCard.module.css'

const ITEM_KEYWORDS = {
  Burn:      "Deals a percent of the target's max Health as true damage every second.",
  Wound:     'Reduces healing received.',
  Sunder:    'Reduces Armor.',
  Shred:     'Reduces Magic Resist.',
  Precision: 'Abilities can critically strike.',
}

function GlossaryFooter({ desc }) {
  if (!desc) return null
  const descLower = desc.toLowerCase()
  const matches = Object.entries(ITEM_KEYWORDS).filter(([term]) =>
    descLower.includes(term.toLowerCase())
  )
  if (matches.length === 0) return null
  return (
    <dl className={styles.glossary}>
      {matches.map(([term, definition]) => (
        <div key={term} className={styles.glossaryEntry}>
          <dt className={styles.glossaryTerm}>{term}</dt>
          <dd className={styles.glossaryDef}>{definition}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ItemCard({ isOpen, data: item, style, allItems, mode, onClose }) {
  if (!isOpen || !item) return null

  const components = itemComponents(item, allItems)
  const stats = visibleItemStats(item)

  return (
    <DetailCardShell
      mode={mode}
      style={style}
      onClose={onClose}
      cardClassName={styles.card}
      label={item.name}
      sheetFooter={<ItemStatsSheetLink itemId={item.apiName || item.id} onNavigate={onClose} />}
    >
      <span className={styles.name}>{item.name}</span>

      {stats.length > 0 && (
        <ul className={styles.statList}>
          {stats.map((stat, i) => (
            <li key={i} className={styles.statRow}>
              <StatIcon type={stat.icon} size={14} />
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statName}>{stat.label}</span>
            </li>
          ))}
        </ul>
      )}

      {components.length === 2 && (
        <div className={styles.recipe}>
          <ItemIcon item={components[0]} size={24} />
          <span className={styles.recipePlus}>+</span>
          <ItemIcon item={components[1]} size={24} />
        </div>
      )}

      {item.desc && (
        <p className={styles.desc}>
          <ItemDescription desc={item.desc} effects={item.effects} calculations={item.calculations} />
        </p>
      )}

      <GlossaryFooter desc={item.desc} />
    </DetailCardShell>
  )
}
