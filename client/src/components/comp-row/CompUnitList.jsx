import { UnitsGrid } from './BoardPieces.jsx'
import CompStatBlock from './CompStatBlock.jsx'
import styles from '../CompRow.module.css'

export default function CompUnitList({ resolvedUnits, items, playRate, winRate, avgPlacement }) {
  return (
    <div className={styles.body}>
      <div className={styles.unitsRow}>
        <UnitsGrid resolvedUnits={resolvedUnits} allItems={items} />
      </div>
      <CompStatBlock playRate={playRate} winRate={winRate} avgPlacement={avgPlacement} />
    </div>
  )
}
