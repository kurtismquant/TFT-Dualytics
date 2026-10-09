import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CompRow from '../CompRow.jsx'
import { useTopComps } from '../../hooks/useTopComps.js'
import { getUniqueTraitIds } from '../../utils/compName.js'
import { buildUnitPath } from '../../constants/routes.js'
import compStyles from '../../pages/CompPage.module.css'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from '../../pages/UnitStatsPage.module.css'

// Top comps that field the unit, best avg placement first. Reuses the Comps
// page's all-comps response (same query key), filtered client-side.
export default function UnitCompsView({ unitId, patch, champions, items, traits }) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useTopComps({ limit: 0, patch })
  const matchCount = data?.matchCount ?? 0

  const comps = useMemo(
    () => (data?.comps || [])
      .filter(comp => comp.units?.some(unit => unit.id === unitId))
      .sort((a, b) => a.avgPlacement - b.avgPlacement || b.playCount - a.playCount),
    [data?.comps, unitId]
  )
  const uniqueTraitIds = useMemo(() => getUniqueTraitIds(champions || [], traits || []), [champions, traits])
  const getUnitHref = useCallback(id => buildUnitPath(id, patch), [patch])

  return (
    <>
      <h2 className={styles.sectionTitle}>{t('unit.compsTitle')}</h2>
      {isLoading && <p className={statsStyles.message} role="status" aria-live="polite">{t('comp.loading')}</p>}
      {isError && <p className={statsStyles.message} role="alert">{t('comp.error')}</p>}
      {!isLoading && !isError && comps.length === 0 && (
        <p className={styles.notEnough} role="status"><span>{t('unit.noComps')}</span></p>
      )}
      {comps.length > 0 && (
        <>
          <p className={`${statsStyles.meta} ${styles.tableMeta}`}>{t('unit.compCount', { count: comps.length })}</p>
          <div className={compStyles.compList}>
            {comps.map(comp => (
              <CompRow
                key={comp.fingerprint}
                comp={comp}
                champions={champions || []}
                items={items || []}
                traits={traits || []}
                matchCount={matchCount}
                uniqueTraitIds={uniqueTraitIds}
                getUnitHref={getUnitHref}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
