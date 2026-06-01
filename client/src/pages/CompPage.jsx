import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChampions } from "../hooks/useChampions.js";
import { useTopComps } from "../hooks/useTopComps.js";
import { useItems } from "../hooks/useItems.js";
import { useTraits } from "../hooks/useTraits.js";
import CompRow from "../components/CompRow.jsx";
import CompSearchBar from "../components/CompSearchBar.jsx";
import { filterComps } from "../utils/compSearch.js";
import styles from "./CompPage.module.css";

export default function CompPage() {
  const { t } = useTranslation();
  const [compSearch, setCompSearch] = useState('');
  const [selectedPatch, setSelectedPatch] = useState(null);
  const { data: champions } = useChampions();
  const { data: items } = useItems();
  const { data: traits } = useTraits();
  const { data: compsData, isLoading, isError } = useTopComps({ limit: 0, patch: selectedPatch });

  const comps = useMemo(() => compsData?.comps || [], [compsData?.comps]);
  const matchCount = compsData?.matchCount ?? 0;
  const patches = compsData?.patches || [];
  const patchHelpId = 'comp-patch-help';
  const filteredComps = useMemo(
    () => filterComps(comps, champions || [], traits || [], compSearch),
    [comps, champions, traits, compSearch]
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('comp.pageTitle')}</h1>
      <p id={patchHelpId} className="sr-only">{t('comp.patchHelp')}</p>
      <div className={styles.controls}>
        <select
          className={styles.select}
          value={compsData?.patch || selectedPatch || ''}
          onChange={event => setSelectedPatch(event.target.value)}
          aria-label={t('comp.patchLabel')}
          aria-describedby={patchHelpId}
        >
          {patches.length === 0 && <option value="">{t('comp.noPatch')}</option>}
          {patches.map(option => <option key={option} value={option}>{option}</option>)}
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
          {filteredComps.length > 0 ? (
            <div className={styles.compList}>
              {filteredComps.map((comp) => (
                <CompRow
                  key={comp.fingerprint}
                  comp={comp}
                  champions={champions || []}
                  items={items || []}
                  traits={traits || []}
                />
              ))}
            </div>
          ) : (
            <p className={styles.emptySearch} role="status">{t('comp.noMatch')}</p>
          )}
        </>
      )}
    </div>
  );
}
