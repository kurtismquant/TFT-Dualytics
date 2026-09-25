import { DOUBLE_UP_QUEUE_ID } from '../constants/game.js'
import { toTeamPlacement } from './teamPlacement.js'

// Set 18 (TFT's Unreal client) changed the match-v1 payload for Double Up:
//   - info.tft_game_type is "standard" instead of "pairs"; queue_id 1160 still
//     identifies Double Up.
//   - participants no longer carry partner_group_id.
// Everything downstream (storage, normalizer, aggregators, Mongo filters) keys
// on the old shape, so raw matches are normalized back to it once, right where
// they arrive from Riot. Partners always share a team placement (teamPlacement.js),
// so ceil(placement / 2) is a stable partner group id when Riot omits one.
export function normalizeRiotMatch(raw) {
  const info = raw?.info
  if (!info) return raw
  const isDoubleUp = info.tft_game_type === 'pairs' || info.queue_id === DOUBLE_UP_QUEUE_ID
  if (!isDoubleUp) return raw
  return {
    ...raw,
    info: {
      ...info,
      tft_game_type: 'pairs',
      participants: (info.participants || []).map(p =>
        p.partner_group_id != null ? p : { ...p, partner_group_id: toTeamPlacement(p.placement) }
      ),
    },
  }
}
