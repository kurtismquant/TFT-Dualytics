import axios from 'axios'
import PQueue from 'p-queue'

// Riot API key lives ONLY in this file. Never import RIOT_API_KEY elsewhere.
const API_KEY = process.env.RIOT_API_KEY

// Personal key: 20 req/sec AND 100 req / 2 min. Both must hold — a request
// clears the long-window queue first, then the short-window queue.
const longQueue = new PQueue({ interval: 120_000, intervalCap: 100 })
const shortQueue = new PQueue({ interval: 1000, intervalCap: 20 })

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Rolling request log for rate-limit visibility (last 60 seconds)
const requestLog = []
// Cumulative count of every Riot request issued this process — lets long-running
// jobs (e.g. the ingestion daemon) report exact calls consumed per run.
let totalRequests = 0

function logRequest() {
  const now = Date.now()
  totalRequests += 1
  requestLog.push(now)
  const cutoff = now - 60_000
  while (requestLog.length && requestLog[0] < cutoff) requestLog.shift()
}

export function getTotalRequestCount() {
  return totalRequests
}

export function getRateLimitStats() {
  const now = Date.now()
  const cutoff = now - 60_000
  while (requestLog.length && requestLog[0] < cutoff) requestLog.shift()
  return {
    requestsLastMinute: requestLog.length,
    limitPerMinute: 50,         // personal key: 100 per 2 min ≈ 50 per min sustained
    longQueueSize: longQueue.size,
    longQueuePending: longQueue.pending,
    shortQueueSize: shortQueue.size,
    shortQueuePending: shortQueue.pending,
  }
}

// priority: higher number = pulled from longQueue sooner.
// User-initiated requests should use priority 10; aggregation uses 0 (default).
// signal: optional AbortSignal — queued jobs are dropped and in-flight requests are cancelled.
export const riotRequest = async (url, priority = 0, signal = null) => {
  const queueOptions = signal ? { priority, signal } : { priority }
  return longQueue.add(
    () => shortQueue.add(
      async () => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        logRequest()
        try {
          const response = await axios.get(url, {
            headers: { 'X-Riot-Token': API_KEY },
            timeout: 15_000,
            signal,
          })
          return response.data
        } catch (err) {
          if (signal?.aborted || err?.code === 'ERR_CANCELED') throw new DOMException('Aborted', 'AbortError')
          if (err.response?.status === 429) {
            const retryAfter = parseInt(err.response.headers['retry-after'] || '5') * 1000
            await sleep(retryAfter)
            return riotRequest(url, priority, signal)
          }
          if (err.response?.status === 403) {
            throw Object.assign(new Error('Riot API key is expired or invalid — regenerate your personal key'), { statusCode: 403 })
          }
          throw err
        }
      },
      queueOptions
    ),
    queueOptions
  )
}

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
