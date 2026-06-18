import { TraitChips } from './BoardPieces.jsx'
import styles from '../CompRow.module.css'

export default function CompRowHeader({ name, comp, traits, champions, excludeTraitIds }) {
  return (
    <div className={styles.headerBar}>
      <span className={styles.compName} title={name}>{name}</span>
      <div className={styles.headerRight}>
        <div className={styles.traitRow}>
          <TraitChips
            traitData={comp.traits}
            traits={traits}
            allChampions={champions}
            excludeTraitIds={excludeTraitIds}
          />
        </div>
      </div>
    </div>
  )
}
