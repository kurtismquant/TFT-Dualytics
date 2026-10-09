import StatIcon from '../StatIcon.jsx'
import { tokenize } from '../../utils/descriptionTokenizer.js'
import { round2 } from '../../utils/itemStats.js'
import styles from './ItemDescription.module.css'

// An item's tooltip text with its values filled in, scaling highlighted and stat
// icons inline. Used by the item hover card and the item stats page.
export default function ItemDescription({ desc, effects, calculations }) {
  const variables = (effects || []).map(e => {
    const v = e.value > 0 && e.value < 1 ? round2(e.value * 100) : e.value
    return { name: e.name, value: [v] }
  })
  // `calculations` carries the values of client-sourced tooltips (Set 18 items).
  const nodes = tokenize(desc, variables, null, null, calculations)
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
