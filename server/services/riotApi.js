import axios from 'axios'

// Riot API key lives ONLY in this file. Never import RIOT_API_KEY elsewhere.
const API_KEY = process.env.RIOT_API_KEY

// Personal key: 20 req/sec AND 100 req/2min. Enforced as SLIDING windows over
// actual dispatch times: a request fires only when both windows have room.
// A fixed-window limiter (previous p-queue setup) drifts out of phase with
// Riot's own bucket, drawing 429 storms whose retries double-spend the budget;
// a sliding window keeps every possible 1s/120s span under the caps no matter
// how Riot aligns its bucket, so sustained large batches get the full 100/2min.
// Short window enforced over 1.2s instead of Riot's 1s: dispatch spacing is
// exact, but network jitter compresses arrivals and Riot counts on receipt —
// the extra 200ms keeps a jitter-squeezed second from exceeding 20 at Riot's edge.
const SHORT_WINDOW_MS = 1_200
const SHORT_CAP = 20
const LONG_WINDOW_MS = 120_000
const LONG_CAP = 100
// Slack added when sleeping until a slot frees, absorbing timer jitter.
const SLOT_EPSILON_MS = 25

// Riot's edge intermittently returns 401 for a perfectly valid key — most often
// in the minutes after a dev key is regenerated (the new key is still propagating
// across edge nodes), so identical calls alternate success/401. Treat 401 as
// transient and retry a bounded number of times before surfacing the auth error,
// so these blips don't fail a whole batch. Bounded so a genuinely dead key can't loop.
const AUTH_RETRY_LIMIT = 2
const AUTH_RETRY_DELAY_MS = 1_500

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Dispatch timestamps within the last LONG_WINDOW_MS (ascending).
const sentLog = []
// Cumulative count of every Riot request issued this process — lets long-running
// jobs (e.g. the ingestion daemon) report exact calls consumed per run.
let totalRequests = 0
let retriesAfter429 = 0
let inFlight = 0

// Jobs waiting for a rate-limit slot: highest priority first, FIFO within.
const pending = []
let nextSeq = 0
let pumpTimer = null

function pruneSentLog(now) {
  while (sentLog.length && sentLog[0] <= now - LONG_WINDOW_MS) sentLog.shift()
}

// 0 when a request may fire now, otherwise ms until the next slot frees.
function msUntilSlot(now) {
  pruneSentLog(now)
  if (sentLog.length >= LONG_CAP) {
    return sentLog[sentLog.length - LONG_CAP] + LONG_WINDOW_MS - now
  }
  let recent = 0
  for (let i = sentLog.length - 1; i >= 0 && sentLog[i] > now - SHORT_WINDOW_MS; i--) recent += 1
  if (recent >= SHORT_CAP) {
    return sentLog[sentLog.length - SHORT_CAP] + SHORT_WINDOW_MS - now
  }
  return 0
}

// Dispatch as many pending jobs as the windows allow; when a window is full,
// sleep exactly until the oldest blocking dispatch ages out, then resume.
function pump() {
  if (pumpTimer) {
    clearTimeout(pumpTimer)
    pumpTimer = null
  }
  while (pending.length) {
    if (pending[0].settled) {
      pending.shift()
      continue
    }
    const now = Date.now()
    const wait = msUntilSlot(now)
    if (wait > 0) {
      pumpTimer = setTimeout(pump, wait + SLOT_EPSILON_MS)
      return
    }
    const job = pending.shift()
    sentLog.push(now)
    totalRequests += 1
    execute(job)
  }
}

function enqueue(job) {
  pending.push(job)
  pending.sort((a, b) => (b.priority - a.priority) || (a.seq - b.seq))
  pump()
}

// Auth failures (401/403) share a clear, actionable message and an isAuthError tag
// so callers (e.g. the leaderboard aggregator) can distinguish them from other errors
// and avoid overwriting good cached data on a key outage. Never include API_KEY.
function authError(status) {
  return Object.assign(
    new Error('Riot API key is expired or invalid — regenerate your personal key'),
    { statusCode: status, isAuthError: true }
  )
}

async function execute(job) {
  const { url, priority, signal, attempt } = job
  inFlight += 1
  try {
    const response = await axios.get(url, {
      headers: { 'X-Riot-Token': API_KEY },
      timeout: 15_000,
      signal,
    })
    job.settle(null, response.data)
  } catch (err) {
    if (signal?.aborted || err?.code === 'ERR_CANCELED') {
      job.settle(new DOMException('Aborted', 'AbortError'))
    } else if (err.response?.status === 429) {
      // Backstop for budget consumed outside this scheduler: another process on
      // the same key (ingest daemon), or a Riot window already part-spent
      // before a server restart wiped the dispatch log.
      retriesAfter429 += 1
      const retryAfter = parseInt(err.response.headers['retry-after'] || '5') * 1000
      await sleep(retryAfter)
      try {
        job.settle(null, await riotRequest(url, priority, signal))
      } catch (retryErr) {
        job.settle(retryErr)
      }
    } else if (err.response?.status === 401 && attempt < AUTH_RETRY_LIMIT) {
      // Transient edge 401 on a valid key (see AUTH_RETRY_LIMIT note). Re-enter via
      // riotRequest so the retry respects the rate-limiter budget; bounded by attempt.
      await sleep(AUTH_RETRY_DELAY_MS)
      try {
        job.settle(null, await riotRequest(url, priority, signal, attempt + 1))
      } catch (retryErr) {
        job.settle(retryErr)
      }
    } else if (err.response?.status === 401 || err.response?.status === 403) {
      job.settle(authError(err.response.status))
    } else {
      job.settle(err)
    }
  } finally {
    inFlight -= 1
  }
}

export function getTotalRequestCount() {
  return totalRequests
}

export function getRateLimitStats() {
  const now = Date.now()
  pruneSentLog(now)
  let lastMinute = 0
  for (let i = sentLog.length - 1; i >= 0 && sentLog[i] > now - 60_000; i--) lastMinute += 1
  return {
    requestsLastMinute: lastMinute,
    limitPerMinute: 50, // personal key: 100 per 2 min ≈ 50 per min sustained
    queuedRequests: pending.length,
    inFlightRequests: inFlight,
    retriesAfter429,
  }
}

// priority: higher number = dispatched sooner (FIFO within a priority).
// User-initiated requests should use priority 10; background work uses 0 (default).
// signal: optional AbortSignal — queued jobs are dropped and in-flight requests cancelled.
// attempt: internal — bounded-401-retry counter, threaded by execute(). Do not pass externally.
export const riotRequest = (url, priority = 0, signal = null, attempt = 0) =>
  new Promise((resolve, reject) => {
    const job = {
      url,
      priority,
      signal,
      attempt,
      seq: nextSeq++,
      settled: false,
      settle(err, data) {
        if (job.settled) return
        job.settled = true
        if (err) reject(err)
        else resolve(data)
      },
    }
    if (signal) {
      if (signal.aborted) {
        job.settle(new DOMException('Aborted', 'AbortError'))
        return
      }
      // Settling marks the job; pump() discards settled jobs when they surface.
      signal.addEventListener('abort', () => job.settle(new DOMException('Aborted', 'AbortError')), { once: true })
    }
    enqueue(job)
  })

export const getMassRegion = (region) => {
  const map = {
    na1: 'americas', na: 'americas', br1: 'americas', br: 'americas', la1: 'americas', la2: 'americas', lan: 'americas', las: 'americas',
    euw1: 'europe', euw: 'europe', eun1: 'europe', eune: 'europe', tr1: 'europe', tr: 'europe', ru: 'europe',
    kr: 'asia', jp1: 'asia', jp: 'asia',
    oc1: 'sea', oce: 'sea', sg2: 'sea', sea: 'sea', ph2: 'sea', th2: 'sea', tw2: 'sea', tw: 'sea', vn2: 'sea', vn: 'sea', me1: 'sea', me: 'sea',
  }
  return map[region?.toLowerCase()] || 'americas'
}

// Normalizes short region codes (na, euw, kr…) to the full platform host (na1, euw1, kr…)
export const getPlatformRegion = (region) => {
  const map = {
    na: 'na1', na1: 'na1',
    euw: 'euw1', euw1: 'euw1',
    eune: 'eun1', eun1: 'eun1',
    kr: 'kr',
    jp: 'jp1', jp1: 'jp1',
    br: 'br1', br1: 'br1',
    lan: 'la1', la1: 'la1',
    las: 'la2', la2: 'la2',
    oce: 'oc1', oc1: 'oc1',
    tr: 'tr1', tr1: 'tr1',
    ru: 'ru',
    vn: 'vn2', vn2: 'vn2',
    tw: 'tw2', tw2: 'tw2',
    sea: 'sg2', sg2: 'sg2',
    me: 'me1', me1: 'me1',
  }
  return map[region?.toLowerCase()] || region?.toLowerCase() || 'na1'
}
