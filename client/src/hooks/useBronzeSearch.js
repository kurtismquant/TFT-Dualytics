import { useEffect, useRef, useState } from 'react'
import { findBronzeComps } from '../utils/bronzeComps.js'

const createWorker = () => new Worker(new URL('../workers/bronzeSearch.worker.js', import.meta.url), { type: 'module' })

// Runs findBronzeComps(search) in a Web Worker. A new search while one is
// running terminates that worker rather than queueing behind it. `result`
// stays on the previous search's comps until the new one lands
// (`isSearching`). Falls back to the main thread where Workers don't exist.
export function useBronzeSearch(search) {
  const [state, setState] = useState({ search: null, result: null, error: null })
  const workerRef = useRef(null)
  const busyRef = useRef(false)
  const jobRef = useRef(0)

  useEffect(() => () => workerRef.current?.terminate(), [])

  useEffect(() => {
    if (!search) return
    const job = ++jobRef.current
    const done = (result, error = null) => {
      if (job !== jobRef.current) return
      busyRef.current = false
      setState({ search, result, error })
    }

    if (typeof Worker === 'undefined') {
      try {
        done(findBronzeComps(search))
      } catch (err) {
        done(null, err?.message || 'Search failed')
      }
      return
    }
    if (busyRef.current) {
      workerRef.current?.terminate()
      workerRef.current = null
    }
    if (!workerRef.current) workerRef.current = createWorker()
    const worker = workerRef.current
    worker.onmessage = event => {
      if (event.data.job === job) done(event.data.result ?? null, event.data.error ?? null)
    }
    worker.onerror = event => done(null, event.message || 'Search failed')
    busyRef.current = true
    worker.postMessage({ job, args: search })
  }, [search])

  return { result: state.result, error: state.error, isSearching: Boolean(search) && state.search !== search }
}
