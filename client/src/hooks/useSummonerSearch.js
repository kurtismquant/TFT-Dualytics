import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  normalizeRegion,
  parseRiotId,
  resolveRiotIdCandidates,
  summonerPath,
  validRiotId,
  withDefaultTag,
} from '../utils/riotSearch.js'

/**
 * Single source of truth for summoner-search behavior shared by every search
 * surface (page, nav, hero). Owns region/name state, Riot-ID parsing, ambiguous
 * candidate resolution, the a11y element ids, and the submit/keydown handlers.
 *
 * Surfaces differ only in presentation; the knobs below cover their few real
 * behavioral differences:
 *  - `idPrefix`        unique element-id namespace (e.g. 'nav-search').
 *  - `normalizeInitialRegion` page lookup normalizes 'na1' aliases; others don't.
 *  - `resetOnNavigate` the nav bar clears itself after navigating.
 *  - `errorKey`        i18n key for an invalid Riot ID ('search.error' vs '…Short').
 */
export function useSummonerSearch({
  idPrefix,
  defaultRegion = 'na',
  defaultName = '',
  normalizeInitialRegion = false,
  resetOnNavigate = false,
  errorKey = 'search.error',
} = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [region, setRegion] = useState(
    normalizeInitialRegion ? normalizeRegion(defaultRegion) : defaultRegion
  )
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [isResolving, setIsResolving] = useState(false)

  const ids = {
    errorId: `${idPrefix}-error`,
    statusId: `${idPrefix}-status`,
    candidateId: `${idPrefix}-candidates`,
    regionHelpId: `${idPrefix}-region-help`,
    inputHelpId: `${idPrefix}-input-help`,
  }

  const statusText = isResolving ? t('search.resolving') : ''
  const inputDescriptionIds = [
    ids.inputHelpId,
    error ? ids.errorId : null,
    statusText ? ids.statusId : null,
    candidates.length ? `${ids.candidateId}-status` : null,
  ].filter(Boolean).join(' ')

  const navigateToId = (id) => {
    navigate(summonerPath(region, id))
    if (resetOnNavigate) {
      setName('')
      setCandidates([])
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCandidates([])

    const id = parseRiotId(name)
    if (!validRiotId(id)) {
      setError(t(errorKey))
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
      // Keep the default-tag behavior if MongoDB resolution is unavailable.
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

  // Clears error + stale candidates as the user edits the field.
  const handleNameChange = (e) => {
    setName(e.target.value)
    setError('')
    setCandidates([])
  }

  return {
    region,
    setRegion,
    name,
    error,
    candidates,
    isResolving,
    ids,
    statusText,
    inputDescriptionIds,
    navigateToId,
    handleSubmit,
    handleInputKeyDown,
    handleNameChange,
  }
}
