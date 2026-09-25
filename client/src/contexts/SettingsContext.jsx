import { useEffect, useLayoutEffect, useState } from 'react'
import i18n from '../i18n/index.js'
import { DEFAULT_UI_SCALE, UI_SCALES } from '../constants/uiScale.js'
import { SettingsContext } from './settingsContext.js'

function readUiScale() {
  const stored = localStorage.getItem('uiScale')
  return stored in UI_SCALES ? stored : DEFAULT_UI_SCALE
}

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('theme') || 'dark'
  )
  const [language, setLanguageState] = useState(
    () => localStorage.getItem('language') || 'en'
  )
  const [uiScale, setUiScaleState] = useState(readUiScale)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    i18n.changeLanguage(language)
    localStorage.setItem('language', language)
  }, [language])

  // Layout effect so the page never paints at the wrong size on load.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-ui-scale', uiScale)
    localStorage.setItem('uiScale', uiScale)
  }, [uiScale])

  // Apply theme immediately on mount (before first paint)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SettingsContext.Provider
      value={{
        theme, setTheme: setThemeState,
        language, setLanguage: setLanguageState,
        uiScale, setUiScale: setUiScaleState,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
