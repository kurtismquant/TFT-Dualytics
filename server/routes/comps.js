import { Router } from 'express'
import { getComps } from '../services/compsAggregator.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit == null ? 20 : Number(req.query.limit)
    const patch = req.query.patch || null
    const result = await getComps({ patch, limit })
    res.json(result)
  } catch (err) {
    console.error('Failed to load aggregated comps:', err.message)
    res.status(500).json({ comps: [], matchCount: 0, patches: [], patch: null, lastUpdated: null, error: 'Failed to load comps' })
  }
})

export default router
