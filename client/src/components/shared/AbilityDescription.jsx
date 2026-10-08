import StatIcon from '../StatIcon.jsx'
import { tokenize } from '../../utils/descriptionTokenizer.js'
import styles from './AbilityDescription.module.css'

// A unit ability's description with its values filled in: star-level values
// highlighted, stat-scaling icons inline. Shared by the unit hover card and the
// unit stats page.
export default function AbilityDescription({ desc, variables, championId, stats, calculations }) {
  const nodes = tokenize(desc, variables, championId, stats, calculations)
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
