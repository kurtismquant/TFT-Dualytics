import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CompRowHeader from './comp-row/CompRowHeader.jsx'
import CompUnitList from './comp-row/CompUnitList.jsx'
import PartnerRows from './comp-row/PartnerRows.jsx'
import { resolveUnits } from './comp-row/resolveUnits.js'
import { generateCompName } from '../utils/compName.js'
import styles from './CompRow.module.css'

export default function CompRow({ comp, champions, items, traits, matchCount, uniqueTraitIds }) {
  const { t } = useTranslation()
  const reactId = useId()
  const [expanded, setExpanded] = useState(false)
  const buttonId = `${reactId}-comp-toggle`
  const panelId = `${reactId}-comp-details`
  const headingId = `${reactId}-comp-heading`
  const resolvedUnits = useMemo(
    () => resolveUnits(comp.units, champions, items),
    [comp.units, champions, items]
  )
  const name = useMemo(
    () => generateCompName(comp, { champions, traits, uniqueTraitIds }),
    [comp, champions, traits, uniqueTraitIds]
  )
  const playRate = matchCount > 0 ? comp.playCount / matchCount : 0

  const toggleExpand = () => setExpanded(v => !v)

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.rowButton}
        onClick={toggleExpand}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? t('comp.collapseCompDetails') : t('comp.expandCompDetails')}
        id={buttonId}
      >
        <div className={styles.compactContent}>
        <CompRowHeader
          name={name}
          comp={comp}
          traits={traits}
          champions={champions}
          excludeTraitIds={uniqueTraitIds}
        />
        <CompUnitList
          resolvedUnits={resolvedUnits}
          items={items}
          playRate={playRate}
          winRate={comp.winRate}
          avgPlacement={comp.avgPlacement}
        />
        </div>
      </button>

      {expanded && (
        <div
          className={styles.expandedBody}
          id={panelId}
          role="region"
          aria-labelledby={headingId}
        >
          <h3 className={styles.expandedHeader} id={headingId}>{t('comp.topTeammateComps')}</h3>
          <PartnerRows
            partners={comp.topPartners}
            champions={champions}
            items={items}
            traits={traits}
            parentGames={comp.playCount}
            uniqueTraitIds={uniqueTraitIds}
          />
        </div>
      )}
    </div>
  )
}
