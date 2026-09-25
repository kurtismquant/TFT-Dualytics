import { CURRENT_SET, SET_PATCH_SCHEDULE } from '../constants/game.js'

// Pure TFT patch math, shared by the Stats and Comps aggregators so both pages
// label and filter patches identically. No DB / network access — keep it that
// way so it stays unit-testable and free of side effects.
//
// Set 18 match payloads carry no usable game_version ("TFT Unreal Version
// ?.?.?.?"), so a match's patch is derived from its game_datetime against the
// SET_PATCH_SCHEDULE windows in constants/game.js.

// Epoch-ms game_datetime → TFT label (e.g. "18.2"). Returns null for games
// before the set's first patch or for non-numeric input.
export function patchForTimestamp(ms, schedule = SET_PATCH_SCHEDULE) {
  if (!Number.isFinite(ms)) return null
  let label = null
  for (const entry of schedule) {
    if (ms >= entry.startsAt) label = entry.patch
  }
  return label
}

// TFT label (e.g. "18.4") → comparable integer (1804) so patch recency can be
// compared numerically. Returns null for null/malformed labels.
export function patchToNum(label) {
  const m = String(label || '').match(/^(\d+)\.(\d+)$/)
  if (!m) return null
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10)
}

// TFT label → { start, end } epoch-ms window (end is null for the newest patch).
// Returns null for labels not in the schedule.
export function patchWindow(tftPatch, schedule = SET_PATCH_SCHEDULE) {
  const idx = schedule.findIndex(entry => entry.patch === tftPatch)
  if (idx === -1) return null
  return { start: schedule[idx].startsAt, end: schedule[idx + 1]?.startsAt ?? null }
}

// Builds the Mongo filter for a Double Up + current-set read, optionally scoped
// to a single TFT patch's gameDatetime window.
export function buildStatsMatchFilter(tftPatch = null) {
  const filter = { 'info.tft_game_type': 'pairs', tftSetNumber: CURRENT_SET }
  const window = tftPatch ? patchWindow(tftPatch) : null
  if (window) {
    filter.gameDatetime = window.end == null
      ? { $gte: window.start }
      : { $gte: window.start, $lt: window.end }
  }
  return filter
}
