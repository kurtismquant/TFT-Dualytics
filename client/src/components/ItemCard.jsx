import ItemIcon from './ItemIcon.jsx'
import StatIcon from './StatIcon.jsx'
import DetailCardShell from './shared/DetailCardShell.jsx'
import { tokenize } from '../utils/descriptionTokenizer.js'
import styles from './ItemCard.module.css'

// pct = show "%" suffix (for stats that are inherently percentages)
const STAT_DISPLAY = {
  AD:           { label: 'AD',           icon: 'ad' },
  AttackDamage: { label: 'AD',           icon: 'ad' },
  AP:           { label: 'AP',           icon: 'ap' },
  AbilityPower: { label: 'AP',           icon: 'ap' },
  ManaRegen:    { label: 'Mana Regen',   icon: 'mana' },
  Mana:         { label: 'Mana Regen',   icon: 'mana' },
  Health:       { label: 'Health',       icon: 'hp' },
  HP:           { label: 'Health',       icon: 'hp' },
  Armor:        { label: 'Armor',        icon: 'armor' },
  MagicResist:  { label: 'Magic Resist', icon: 'mr' },
  MR:           { label: 'Magic Resist', icon: 'mr' },
  AttackSpeed:  { label: 'Attack Speed', icon: 'as',         pct: true },
  AS:           { label: 'Attack Speed', icon: 'as',         pct: true },
  Durability:   { label: 'Durability',   icon: 'durability', pct: true },
  Range:        { label: 'Range',        icon: 'range' },
}

const ITEM_KEYWORDS = {
  Burn:      'Deals a percent of the target\'s max Health as true damage every second.',
  Wound:     'Reduces healing received.',
  Sunder:    'Reduces Armor.',
  Shred:     'Reduces Magic Resist.',
  Precision: 'Abilities can critically strike.',
}

const round2 = (n) => Math.round(n * 100) / 100

// Values < 1 are stored as fractions by CDragon (0.10 = 10%) — normalize to percent first.
function formatStatValue(value, pct) {
  if (value == null) return null
  const scaled = value > 0 && value < 1 ? round2(value * 100) : round2(value)
  return pct ? `+${scaled}%` : `+${scaled}`
}

function ItemDesc({ desc, effects }) {
  const variables = (effects || []).map(e => {
    const v = e.value > 0 && e.value < 1 ? round2(e.value * 100) : e.value
    return { name: e.name, value: [v] }
  })
  const nodes = tokenize(desc, variables)
  if (nodes.length === 0) return null
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'var') {
          return <strong key={i} className={styles.scaling}>{node.content}</strong>
        }
        if (node.type === 'icon') {
          return <StatIcon key={i} type={node.iconType} />
        }
        if (node.type === 'buff') {
          return <span key={i} className={styles.buffName}>{node.content}</span>
        }
        if (node.type === 'plus') {
          return <span key={i} className={styles.opPlus}> + </span>
        }
        return <span key={i}>{node.content}</span>
      })}
    </>
  )
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

  const components = (item.composition || [])
    .map(id => (allItems || []).find(i => i.id === id))
    .filter(Boolean)

  const visibleEffects = (item.effects || [])
    .filter(e => e.name && e.value != null && STAT_DISPLAY[e.name])

  return (
    <DetailCardShell mode={mode} style={style} onClose={onClose} cardClassName={styles.card} label={item.name}>
      <span className={styles.name}>{item.name}</span>

      {visibleEffects.length > 0 && (
        <ul className={styles.statList}>
          {visibleEffects.map((e, i) => {
            const { label, icon, pct } = STAT_DISPLAY[e.name]
            const val = formatStatValue(e.value, pct)
            if (!val) return null
            return (
              <li key={i} className={styles.statRow}>
                <StatIcon type={icon} size={14} />
                <span className={styles.statValue}>{val}</span>
                <span className={styles.statName}>{label}</span>
              </li>
            )
          })}
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
          <ItemDesc desc={item.desc} effects={item.effects} />
        </p>
      )}

      <GlossaryFooter desc={item.desc} />
    </DetailCardShell>
  )
}
