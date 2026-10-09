import { Router } from 'express'
import { getStats } from '../services/statsAggregator.js'
import { getUnitItemCombos, MIN_COMBO_GAMES } from '../services/unitItemCombosAggregator.js'
import { exploreCurrentPatch } from '../services/boardExplorer.js'

const router = Router()

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

// Board explorer over the current patch: ?units=ID:1-3:ITEM+ITEM&traits=ID:2&items=ID
router.get('/explorer', (req, res) => {
  try {
    const result = exploreCurrentPatch(req.query)
    res.status(result.ready ? 200 : 503).json(result)
  } catch (err) {
    const status = err.status || 500
    if (status >= 500) console.error('Board explorer failed:', err.message)
    res.status(status).json({ ready: false, error: status === 400 ? err.message : 'Board explorer failed' })
  }
})

export default router
