import { useMemo } from 'react'
import { TraitChips, UnitsGrid } from './BoardPieces.jsx'
import CompStatBlock from './CompStatBlock.jsx'
import { placementBucket } from './formatters.js'
import { resolveUnits } from './resolveUnits.js'
import { generateCompName } from '../../utils/compName.js'
import styles from '../CompRow.module.css'

const PLACEMENT_CLASS = { 1: styles.p1, 2: styles.p2, 3: styles.p3, 4: styles.p4 }

export default function PartnerRow({ partner, champions, items, traits, parentGames, uniqueTraitIds }) {
  const resolvedUnits = useMemo(
    () => resolveUnits(partner.units, champions, items),
    [partner.units, champions, items]
  )
  const name = useMemo(
    () => generateCompName(partner, { champions, traits, uniqueTraitIds }),
    [partner, champions, traits, uniqueTraitIds]
  )
  const bucket = placementBucket(partner.avgPlacement)
  const placementClass = PLACEMENT_CLASS[bucket] || ''
  // Partner play rate = how often this comp pairs with the parent comp.
  const playRate = parentGames > 0 ? partner.pairCount / parentGames : 0

  return (
    <div className={`${styles.partnerRow} ${placementClass}`} role="listitem">
      <div className={styles.partnerMeta}>
        <span className={styles.compName} title={name}>{name}</span>
      </div>
      <div className={styles.partnerBody}>
        <div className={styles.partnerBoard}>
          <div className={styles.partnerTraits}>
            <TraitChips
              traitData={partner.traits}
              traits={traits}
              allChampions={champions}
              excludeTraitIds={uniqueTraitIds}
            />
          </div>
          <div className={styles.partnerUnits}>
            <UnitsGrid resolvedUnits={resolvedUnits} allItems={items} />
          </div>
        </div>
        <CompStatBlock playRate={playRate} winRate={partner.winRate} avgPlacement={partner.avgPlacement} />
      </div>
    </div>
  )
}
