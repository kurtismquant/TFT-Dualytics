import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Toggles the sentinel file the ingestion daemon polls. Presence = paused.
// Usage: node scripts/ingest-control.js pause|resume
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PAUSE_FILE = path.resolve(__dirname, '.ingest-paused')

const action = process.argv[2]

if (action === 'pause') {
  fs.writeFileSync(PAUSE_FILE, `paused at ${new Date().toISOString()}\n`)
  console.log('Ingestion paused — daemon will stop issuing Riot calls within ~1s.')
} else if (action === 'resume') {
  fs.rmSync(PAUSE_FILE, { force: true })
  console.log('Ingestion resumed.')
} else {
  console.error('Usage: node scripts/ingest-control.js pause|resume')
  process.exit(1)
}
