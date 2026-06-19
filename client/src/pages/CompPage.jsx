import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChampions } from "../hooks/useChampions.js";
import { useTopComps } from "../hooks/useTopComps.js";
import { useItems } from "../hooks/useItems.js";
import { useTraits } from "../hooks/useTraits.js";
import CompRow from "../components/CompRow.jsx";
import CompSearchBar from "../components/CompSearchBar.jsx";
import { filterComps } from "../utils/compSearch.js";
import { getUniqueTraitIds } from "../utils/compName.js";
import { PageShell } from '../components/layout/PageShell.jsx';
import styles from "./CompPage.module.css";

const SORT_OPTIONS = ['placement', 'playRate', 'winRate'];

const SORT_COMPARATORS = {
  // Avg placement: lower is better, so best comps come first.
  placement: (a, b) => a.avgPlacement - b.avgPlacement || b.playCount - a.playCount,
  // Play rate is playCount / matchCount; matchCount is constant within a response,
  // so ranking by playCount is equivalent and avoids a divide.
  playRate: (a, b) => b.playCount - a.playCount || a.avgPlacement - b.avgPlacement,
  winRate: (a, b) => b.winRate - a.winRate || a.avgPlacement - b.avgPlacement,
};

export default function CompPage() {
  const { t } = useTranslation();
  const [compSearch, setCompSearch] = useState('');
  const [selectedPatch, setSelectedPatch] = useState(null);
  const [sortBy, setSortBy] = useState('placement');
  const { data: champions } = useChampions();
  const { data: items } = useItems();
  const { data: traits } = useTraits();
  const { data: compsData, isLoading, isError } = useTopComps({ limit: 0, patch: selectedPatch });

  const comps = useMemo(() => compsData?.comps || [], [compsData?.comps]);
  const matchCount = compsData?.matchCount ?? 0;
  const patches = compsData?.patches || [];
  const patchHelpId = 'comp-patch-help';
  const uniqueTraitIds = useMemo(() => getUniqueTraitIds(champions || []), [champions]);
  const filteredComps = useMemo(
    () => filterComps(comps, champions || [], traits || [], compSearch),
    [comps, champions, traits, compSearch]
  );
  const sortedComps = useMemo(
    () => filteredComps.slice().sort(SORT_COMPARATORS[sortBy] || SORT_COMPARATORS.placement),
    [filteredComps, sortBy]
  );

  return (
    <PageShell>
      <h1 className={styles.title}>{t('comp.pageTitle')}</h1>
      <p id={patchHelpId} className="sr-only">{t('comp.patchHelp')}</p>
      <div className={styles.controls}>
        <select
          className={styles.select}
          value={compsData?.patch || selectedPatch || ''}
          onChange={event => { setSelectedPatch(event.target.value); event.target.blur() }}
          aria-label={t('comp.patchLabel')}
          aria-describedby={patchHelpId}
        >
          {patches.length === 0 && <option value="">{t('comp.noPatch')}</option>}
          {patches.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          className={styles.select}
          value={sortBy}
          onChange={event => { setSortBy(event.target.value); event.target.blur() }}
          aria-label={t('comp.sortLabel')}
        >
          {SORT_OPTIONS.map(option => (
            <option key={option} value={option}>{t(`comp.sort_${option}`)}</option>
          ))}
        </select>
        <CompSearchBar
          value={compSearch}
          onChange={setCompSearch}
          resultCount={filteredComps.length}
          totalCount={comps.length}
        />
      </div>

      {isLoading && (
        <p className={styles.subtitle} role="status" aria-live="polite">{t('comp.loading')}</p>
      )}
      {isError && (
        <p className={styles.error} role="alert">{t('comp.error')}</p>
      )}

      {comps.length === 0 && !isLoading && !isError && (
        <p className={styles.subtitle} role="status">{t('comp.empty')}</p>
      )}

      {comps.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('comp.sectionTitle')}</h2>
            {matchCount > 0 && (
              <span className={styles.sectionMeta}>{t('comp.gamesAnalyzed', { count: matchCount.toLocaleString() })}</span>
            )}
          </div>
          {sortedComps.length > 0 ? (
            <div className={styles.compList}>
              {sortedComps.map((comp) => (
                <CompRow
                  key={comp.fingerprint}
                  comp={comp}
                  champions={champions || []}
                  items={items || []}
                  traits={traits || []}
                  matchCount={matchCount}
                  uniqueTraitIds={uniqueTraitIds}
                />
              ))}
            </div>
          ) : (
            <p className={styles.emptySearch} role="status">{t('comp.noMatch')}</p>
          )}
        </>
      )}
    </PageShell>
  );
}
