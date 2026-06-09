import { useTranslation } from 'react-i18next'

/**
 * The screen-reader help text + polite live status region shared by every
 * summoner search surface. Pairs with `useSummonerSearch`, which supplies the
 * stable element ids and the current `statusText`.
 */
export default function StatusMessages({ ids, statusText }) {
  const { t } = useTranslation()
  return (
    <>
      <p id={ids.regionHelpId} className="sr-only">{t('search.regionHelp')}</p>
      <p id={ids.inputHelpId} className="sr-only">{t('search.riotIdHelp')}</p>
      <p id={ids.statusId} className="sr-only" role="status" aria-live="polite">
        {statusText}
      </p>
    </>
  )
}
