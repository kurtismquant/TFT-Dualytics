import { useTranslation } from 'react-i18next'
import RiotIdCandidates from './RiotIdCandidates.jsx'
import RegionSelect from './ui/RegionSelect.jsx'
import StatusMessages from './ui/StatusMessages.jsx'
import { useSummonerSearch } from '../hooks/useSummonerSearch.js'
import { REGION_DEFAULT_TAG } from '../utils/riotSearch.js'
import styles from './SearchBar.module.css'

export default function SearchBar({
  defaultRegion = 'na1',
  defaultName1 = '',
}) {
  const { t } = useTranslation()
  const search = useSummonerSearch({
    idPrefix: 'summoner-search',
    defaultRegion,
    defaultName: defaultName1,
    normalizeInitialRegion: true,
  })

  return (
    <form className={styles.form} role="search" onSubmit={search.handleSubmit} aria-busy={search.isResolving}>
      <StatusMessages ids={search.ids} statusText={search.statusText} />
      <div className={styles.inputs}>
        <RegionSelect
          className={styles.select}
          value={search.region}
          onChange={e => search.setRegion(e.target.value)}
          aria-label={t('search.regionLabel')}
          aria-describedby={search.ids.regionHelpId}
        />
        <input
          className={styles.input}
          type="text"
          placeholder={`GameName#${REGION_DEFAULT_TAG[search.region] || 'TAG'}`}
          value={search.name}
          onChange={search.handleNameChange}
          onKeyDown={search.handleInputKeyDown}
          aria-label={t('search.riotIdLabel')}
          aria-invalid={!!search.error}
          aria-describedby={search.inputDescriptionIds || undefined}
          maxLength={22}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className={styles.submitBtn} disabled={search.isResolving}>
          {search.isResolving ? t('search.searching') : t('search.search')}
        </button>
      </div>
      {search.error && <p id={search.ids.errorId} className={styles.error} role="alert">{search.error}</p>}
      <RiotIdCandidates id={search.ids.candidateId} players={search.candidates} onSelect={search.navigateToId} />
    </form>
  )
}
