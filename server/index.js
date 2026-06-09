import './loadEnv.js'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import compsRouter from './routes/comps.js'
import summonerRouter from './routes/summoner.js'
import assetsRouter from './routes/assets.js'
import debugRouter from './routes/debug.js'
import leaderboardRouter from './routes/leaderboard.js'
import playersRouter from './routes/players.js'
import statsRouter from './routes/stats.js'
import { fetchAndCacheAssets } from './services/assetResolver.js'
import { runCompAggregation } from './services/compsAggregator.js'
import { runLeaderboardMatchSync } from './services/leaderboardMatchSync.js'
import { connectMongo, createIndexes } from './db/mongo.js'

const app = express()
const PORT = process.env.PORT || 3001
const backgroundJobsEnabled = process.env.ENABLE_BACKGROUND_JOBS !== 'false'
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

let initialized = false

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: initialized ? 'ok' : 'initializing' }))

// Return 503 while startup tasks (DB connect, asset fetch, comp aggregation) are running.
// Vite proxy returns 502 when nothing is listening, which is harder to distinguish from a
// real infrastructure failure. 503 is the correct signal for "not ready yet" and React
// Query's default retry logic handles it transparently.
app.use((req, res, next) => {
  if (!initialized) return res.status(503).json({ error: 'Server initializing, please retry shortly' })
  next()
})

app.use('/api/comps', compsRouter)
app.use('/api/summoner', summonerRouter)
app.use('/api/assets', assetsRouter)
app.use('/api/debug', debugRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/players', playersRouter)
app.use('/api/stats', statsRouter)

async function start() {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))

  try {
    await connectMongo()
    await createIndexes()
    console.log('MongoDB connected')
  } catch (err) {
    console.warn('MongoDB unavailable, running in memory-only mode:', err.message)
  }

  await fetchAndCacheAssets().catch(err => console.error('Asset fetch failed:', err.message))
  if (backgroundJobsEnabled) {
    await runCompAggregation().catch(err => console.error('Initial comp aggregation failed:', err.message))
  }

  initialized = true
  console.log('Server ready')

  if (backgroundJobsEnabled) {
    // Re-aggregate every 10 minutes (Mongo-only, cheap)
    cron.schedule('*/10 * * * *', () => runCompAggregation().catch(console.error))
    // Sync top-50 leaderboard players' match histories every hour, then re-aggregate
    cron.schedule('0 * * * *', () => runLeaderboardMatchSync().catch(console.error))
  }
}

start().catch(err => {
  console.error('Startup failed:', err)
  process.exit(1)
})
