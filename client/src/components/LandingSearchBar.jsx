import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RiotIdCandidates from './RiotIdCandidates.jsx'
import {
  REGIONS,
  parseRiotId,
  resolveRiotIdCandidates,
  summonerPath,
  validRiotId,
  withDefaultTag,
} from '../utils/riotSearch.js'
import styles from '../pages/LandingPage.module.css'

export default function LandingSearchBar({ defaultRegion = 'na', defaultName = '' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [region, setRegion] = useState(defaultRegion)
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [isResolving, setIsResolving] = useState(false)
  const [iconHover, setIconHover] = useState(false)
  const inputRef = useRef(null)
  const errorId = 'landing-search-error'
  const statusId = 'landing-search-status'
  const candidateId = 'landing-search-candidates'
  const regionHelpId = 'landing-search-region-help'
  const inputHelpId = 'landing-search-input-help'
  const statusText = isResolving ? t('search.resolving') : ''
  const inputDescriptionIds = [
    inputHelpId,
    error ? errorId : null,
    statusText ? statusId : null,
    candidates.length ? `${candidateId}-status` : null,
  ].filter(Boolean).join(' ')

  // Focus the search input on load so visitors can type immediately.
  // preventScroll keeps the viewport at the top so the hero stays in view.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const navigateToId = (id) => {
    navigate(summonerPath(region, id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCandidates([])

    const id = parseRiotId(name)
    if (!validRiotId(id)) {
      setError(t('search.error'))
      return
    }

    if (id.hasExplicitTag) {
      navigateToId(id)
      return
    }

    setIsResolving(true)
    try {
      const players = await resolveRiotIdCandidates(region, id.gameName)
      if (players.length === 1) {
        navigateToId(players[0])
        return
      }
      if (players.length > 1) {
        setCandidates(players)
        return
      }
    } catch {
      // Keep the previous default-tag behavior if MongoDB resolution is unavailable.
    } finally {
      setIsResolving(false)
    }

    navigateToId(withDefaultTag(id, region))
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape' && candidates.length) {
      e.stopPropagation()
      setCandidates([])
    }
  }

  return (
    <form className={styles.searchForm} role="search" onSubmit={handleSubmit} aria-busy={isResolving}>
      <p id={regionHelpId} className="sr-only">{t('search.regionHelp')}</p>
      <p id={inputHelpId} className="sr-only">{t('search.riotIdHelp')}</p>
      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusText}
      </p>
      <div className={styles.searchInner}>
        <select
          className={styles.searchSelect}
          value={region}
          onChange={e => setRegion(e.target.value)}
          aria-label={t('search.regionLabel')}
          aria-describedby={regionHelpId}
        >
          {REGIONS.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>

        <div className={styles.searchInputWrap}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search Player#Tag"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); setCandidates([]) }}
            onKeyDown={handleInputKeyDown}
            aria-label={t('search.riotIdLabel')}
            aria-invalid={!!error}
            aria-describedby={inputDescriptionIds || undefined}
            maxLength={22}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={styles.searchInput}
          />
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={isResolving}
            onMouseEnter={() => setIconHover(true)}
            onMouseLeave={() => setIconHover(false)}
            aria-label={isResolving ? t('search.searching') : t('search.search')}
          >
            <svg
              width="18" height="18" viewBox="0 0 18 18" fill="none"
              style={{ opacity: iconHover ? 1 : 0.7, transition: 'opacity 150ms' }}
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="12" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      {error && <p id={errorId} className={styles.searchError} role="alert">{error}</p>}
      <RiotIdCandidates id={candidateId} players={candidates} onSelect={navigateToId} />
    </form>
  )
}
