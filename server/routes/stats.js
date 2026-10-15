import { Router } from 'express'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { getStats } from '../services/statsAggregator.js'
import { getUnitItemCombos, MIN_COMBO_GAMES } from '../services/unitItemCombosAggregator.js'
import { getItemUnits } from '../services/itemUnitsAggregator.js'
import { exploreCurrentPatch, partnersOnCurrentPatch, playedOnCurrentPatch, unitRolesOnCurrentPatch } from '../services/boardExplorer.js'
import { getAllItems } from '../services/assetResolver.js'

const router = Router()
const gzipAsync = promisify(gzip)

router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'units'
    const patch = req.query.patch || null
    const stats = await getStats({ type, patch })
    res.json(stats)
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Failed to load stats:', err.message)
    res.status(status).json({
      type: req.query.type || 'units',
      patch: null,
      patches: [],
      rows: [],
      matchCount: 0,
      participantCount: 0,
      itemCount: 0,
      error: status === 400 ? err.message : 'Failed to load stats',
    })
  }
})

// Every 3-item combo for one unit with at least MIN_COMBO_GAMES boards on the patch.
router.get('/units/:unitId/combos', async (req, res) => {
  try {
    const patch = typeof req.query.patch === 'string' ? req.query.patch : null
    res.json(await getUnitItemCombos({ unitId: req.params.unitId, patch }))
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Failed to load unit item combos:', err.message)
    res.status(status).json({
      unitId: null,
      patch: null,
      patches: [],
      minGames: MIN_COMBO_GAMES,
      games: 0,
      threeItemGames: 0,
      combos: [],
      singleItems: [],
      lastUpdated: null,
      error: status === 400 ? err.message : 'Failed to load unit item combos',
    })
  }
})

// Every unit that held one item on at least MIN_COMBO_GAMES boards on the patch.
router.get('/items/:itemId/units', async (req, res) => {
  try {
    const patch = typeof req.query.patch === 'string' ? req.query.patch : null
    res.json(await getItemUnits({ itemId: req.params.itemId, patch }))
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Failed to load item units:', err.message)
    res.status(status).json({
      itemId: null,
      patch: null,
      patches: [],
      minGames: MIN_COMBO_GAMES,
      games: 0,
      avgPlacement: null,
      winRate: null,
      top2Rate: null,
      units: [],
      lastUpdated: null,
      error: status === 400 ? err.message : 'Failed to load item units',
    })
  }
})

// Board explorer over the current patch: ?units=ID:1-3:ITEM+ITEM&traits=ID:2&items=ID
// Every breakdown row with enough boards is returned, so an unfiltered answer
// runs to several hundred KB of JSON; the server has no compression middleware,
// so gzip it here (~10x smaller).
router.get('/explorer', async (req, res) => {
  try {
    const result = exploreCurrentPatch(req.query)
    res.status(result.ready ? 200 : 503).vary('Accept-Encoding')
    if (!req.acceptsEncodings('gzip')) return res.json(result)
    const body = await gzipAsync(JSON.stringify(result))
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip' }).send(body)
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Board explorer failed:', err.message)
    res.status(status).json({ ready: false, error: status === 400 ? err.message : 'Board explorer failed' })
  }
})

// Exact-board play counts for a batch of unit lists (Bronze for Life's
// "highly played" star): POST { boards: [[unitId, ...], ...] }.
router.post('/explorer/played', (req, res) => {
  try {
    const result = playedOnCurrentPatch(req.body)
    res.status(result.ready ? 200 : 503).json(result)
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Played-board lookup failed:', err.message)
    res.status(status).json({ ready: false, error: status === 400 ? err.message : 'Played-board lookup failed' })
  }
})

// Units fielded alongside all of the given ones (the Team Builder's gold
// "often played with" names): GET ?units=ID,ID.
router.get('/explorer/partners', (req, res) => {
  try {
    const result = partnersOnCurrentPatch(req.query)
    res.status(result.ready ? 200 : 503).json(result)
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Unit partners lookup failed:', err.message)
    res.status(status).json({ ready: false, error: status === 400 ? err.message : 'Unit partners lookup failed' })
  }
})

// Per-unit item roles (share of tank / AD / AP items held) for the Team
// Builder's auto-arrange: GET, no params.
router.get('/explorer/unit-roles', (req, res) => {
  try {
    const result = unitRolesOnCurrentPatch(getAllItems())
    res.status(result.ready ? 200 : 503).json(result)
  } catch (err) {
    console.error('Unit roles lookup failed:', err.message)
    res.status(500).json({ ready: false, error: 'Unit roles lookup failed' })
  }
})

export default router
