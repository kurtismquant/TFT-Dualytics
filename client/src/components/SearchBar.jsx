import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import RiotIdCandidates from './RiotIdCandidates.jsx'
import RegionSelect from './ui/RegionSelect.jsx'
import StatusMessages from './ui/StatusMessages.jsx'
import { useSummonerSearch } from '../hooks/useSummonerSearch.js'
import { useIsMobile } from '../hooks/useMediaQuery.js'
import { REGION_DEFAULT_TAG } from '../utils/riotSearch.js'
import styles from './SearchBar.module.css'

export default function SearchBar({
  defaultRegion = 'na1',
}) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const isMobile = useIsMobile()
  const search = useSummonerSearch({
    idPrefix: 'summoner-search',
    defaultRegion,
    // Field starts empty on load (all sizes); region is still seeded from the URL.
    defaultName: '',
    normalizeInitialRegion: true,
  })

  // Mobile: after picking a region with an empty field, focus the input so the
  // keyboard opens and the user can type immediately.
  const handleRegionChange = (e) => {
    search.setRegion(e.target.value)
    if (isMobile && !search.name) inputRef.current?.focus()
  }

  const searchLabel = search.isResolving ? t('search.searching') : t('search.search')

  return (
    <form className={styles.form} role="search" onSubmit={search.handleSubmit} aria-busy={search.isResolving}>
      <StatusMessages ids={search.ids} statusText={search.statusText} />
      <div className={styles.inputs}>
        <RegionSelect
          className={styles.select}
          value={search.region}
          onChange={handleRegionChange}
          aria-label={t('search.regionLabel')}
          aria-describedby={search.ids.regionHelpId}
        />
        <input
          ref={inputRef}
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
        {/* One submit button: gold gradient text on desktop, gold magnifier on mobile
            (the label/icon are toggled in CSS). Glyph mirrors ui/SearchIconButton. */}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={search.isResolving}
          aria-label={searchLabel}
        >
          <span className={styles.btnLabel}>{searchLabel}</span>
          <svg
            className={styles.btnIcon}
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {search.error && <p id={search.ids.errorId} className={styles.error} role="alert">{search.error}</p>}
      <RiotIdCandidates id={search.ids.candidateId} players={search.candidates} onSelect={search.navigateToId} />
    </form>
  )
}
