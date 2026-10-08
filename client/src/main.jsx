import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App.jsx'
import './styles/globals.css'
import './styles/theme.css'
import './i18n/index.js'
import { SettingsProvider } from './contexts/SettingsContext.jsx'
import { CURRENT_SET } from './constants/game.js'

const ONE_DAY = 24 * 60 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must outlive the persisted maxAge, otherwise queries are
    // garbage-collected before they can be restored from localStorage.
    queries: { staleTime: 5 * 60 * 1000, gcTime: ONE_DAY, retry: 2 },
  },
})

const persister = createSyncStoragePersister({ storage: window.localStorage })

// The buster discards a persisted cache that may describe older data: a new TFT
// set (no flashing last set's numbers on load) or a new deploy (server data
// such as extracted ability/item text usually ships with one). In dev every
// page load starts fresh — server data changes constantly there and a restored
// copy would hide it until it went stale.
const buster = import.meta.env.DEV
  ? String(Date.now())
  : `${CURRENT_SET}:${import.meta.env.VITE_BUILD_ID}`

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: ONE_DAY, buster }}
        >
          <App />
        </PersistQueryClientProvider>
      </BrowserRouter>
    </SettingsProvider>
  </React.StrictMode>
)
