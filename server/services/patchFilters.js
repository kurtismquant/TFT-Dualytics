import { CURRENT_SET, LOL_SEASON, SET_LAUNCH_LOL_MINOR } from '../constants/game.js'

// Pure TFT↔LoL patch math, shared by the Stats and Comps aggregators so both
// pages label and filter patches identically. No DB / network access — keep it
// that way so it stays unit-testable and free of side effects.
//
// TFT and LoL share the same two-week release cadence but use different version
// numbering: LoL uses the season number (16.x) while TFT labels patches within
// a set sequentially (17.1, 17.2, …).

// Raw Riot game_version (e.g. "Version 16.9.614.1234") → TFT label (e.g. "17.2").
export function extractPatch(gameVersion) {
  if (!gameVersion) return null
  const m = String(gameVersion).match(/(\d+)\.(\d+)/)
  if (!m) return null
  const lolMajor = parseInt(m[1], 10)
  const lolMinor = parseInt(m[2], 10)
  if (lolMajor !== LOL_SEASON) return null
  const tftMinor = lolMinor - SET_LAUNCH_LOL_MINOR + 1
  if (tftMinor < 1) return null
  return `${CURRENT_SET}.${tftMinor}`
}

// TFT label (e.g. "17.4") → comparable integer (1704) so patch recency can be
// compared numerically. Returns null for null/non-current-set labels.
export function patchToNum(label) {
  const m = String(label || '').match(/^(\d+)\.(\d+)$/)
  if (!m) return null
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10)
}

// TFT label (e.g. "17.2") → the LoL version used in game_version (e.g. "16.9")
// so DB queries can match the raw Riot field.
function lolPatchFromTft(tftPatch) {
  const m = String(tftPatch || '').match(/^(\d+)\.(\d+)$/)
  if (!m) return null
  const tftMinor = parseInt(m[2], 10)
  return `${LOL_SEASON}.${tftMinor + SET_LAUNCH_LOL_MINOR - 1}`
}

// Builds the Mongo filter for a Double Up + current-set read, optionally scoped
// to a single TFT patch (converted back to the LoL game_version regex).
export function buildStatsMatchFilter(tftPatch = null) {
  const filter = { 'info.tft_game_type': 'pairs', tftSetNumber: CURRENT_SET }
  if (tftPatch) {
    const lolPatch = lolPatchFromTft(tftPatch)
    if (lolPatch) {
      const escaped = lolPatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter['info.game_version'] = { $regex: `\\b${escaped}\\.` }
    }
  }
  return filter
}
