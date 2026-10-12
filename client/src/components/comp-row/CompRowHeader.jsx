import { TraitChips } from './BoardPieces.jsx'
import CopyTeamCodeButton from '../shared/CopyTeamCodeButton.jsx'
import styles from '../CompRow.module.css'

// `teamCode` (a Team Planner code) adds a copy button at the far right; omit to hide it.
export default function CompRowHeader({ name, comp, traits, champions, excludeTraitIds, teamCode }) {
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
        {teamCode !== undefined && <CopyTeamCodeButton code={teamCode} />}
      </div>
    </div>
  )
}
