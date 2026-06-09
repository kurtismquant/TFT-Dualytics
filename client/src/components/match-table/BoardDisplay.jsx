import { TraitChips as SharedTraitChips, UnitsGrid as SharedUnitsGrid } from '../shared/HoverableBoardPieces.jsx'
import styles from '../MatchTable.module.css'

export function TraitChips(props) {
  return <SharedTraitChips {...props} copyBeforeSort={false} />
}

export function UnitsGrid(props) {
  return <SharedUnitsGrid {...props} styles={styles} />
}

export function DamageIcon() {
  return (
    <img
      src="https://raw.communitydragon.org/latest/game/assets/ux/tft/stageicons/announce_icon_combat.png"
      className={styles.damageIcon}
      width="14"
      height="14"
      alt=""
      aria-hidden="true"
    />
  )
}
