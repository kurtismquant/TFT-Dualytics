// Runs the Bronze for Life search off the main thread (up to ~0.5s for 100
// comps of 10 units), so the page stays responsive while it works.
import { findBronzeComps } from '../utils/bronzeComps.js'

self.onmessage = event => {
  const { job, args } = event.data
  try {
    self.postMessage({ job, result: findBronzeComps(args) })
  } catch (err) {
    self.postMessage({ job, error: err?.message || 'Search failed' })
  }
}
