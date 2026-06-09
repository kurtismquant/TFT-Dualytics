import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import RiotIdCandidates from './RiotIdCandidates.jsx'
import RegionSelect from './ui/RegionSelect.jsx'
import StatusMessages from './ui/StatusMessages.jsx'
import SearchIconButton from './ui/SearchIconButton.jsx'
import { useSummonerSearch } from '../hooks/useSummonerSearch.js'
import styles from '../pages/LandingPage.module.css'

export default function LandingSearchBar({ defaultRegion = 'na', defaultName = '' }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const search = useSummonerSearch({
    idPrefix: 'landing-search',
    defaultRegion,
    defaultName,
  })

  // Focus the search input on load so visitors can type immediately.
  // preventScroll keeps the viewport at the top so the hero stays in view.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <form className={styles.searchForm} role="search" onSubmit={search.handleSubmit} aria-busy={search.isResolving}>
      <StatusMessages ids={search.ids} statusText={search.statusText} />
      <div className={styles.searchInner}>
        <RegionSelect
          className={styles.searchSelect}
          value={search.region}
          onChange={e => search.setRegion(e.target.value)}
          aria-label={t('search.regionLabel')}
          aria-describedby={search.ids.regionHelpId}
        />
        <div className={styles.searchInputWrap}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search Player#Tag"
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
            className={styles.searchInput}
          />
          <SearchIconButton
            className={styles.searchBtn}
            disabled={search.isResolving}
            label={search.isResolving ? t('search.searching') : t('search.search')}
            size={18}
            restOpacity={0.7}
          />
        </div>
      </div>
      {search.error && <p id={search.ids.errorId} className={styles.searchError} role="alert">{search.error}</p>}
      <RiotIdCandidates id={search.ids.candidateId} players={search.candidates} onSelect={search.navigateToId} />
    </form>
  )
}
