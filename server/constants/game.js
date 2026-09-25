export const CURRENT_SET = 18

// TFT patch windows for the current set, oldest first. Set 18 moved TFT to its
// Unreal client, whose match-v1 payloads report game_version as
// "TFT Unreal Version ?.?.?.?" — no patch number — so patches are assigned by
// game_datetime instead (see patchFilters.js). Add one entry per TFT patch as it
// goes live. Boundaries are 00:00 UTC on patch day; regional rollouts span most
// of that day, so a few games right at a boundary may land in the adjacent patch.
export const SET_PATCH_SCHEDULE = [
  { patch: '18.1', startsAt: Date.UTC(2026, 7, 26) }, // LoL 16.17, Aug 26 2026
  { patch: '18.2', startsAt: Date.UTC(2026, 8, 9) }, // LoL 16.18, Sep 9 2026
  { patch: '18.3', startsAt: Date.UTC(2026, 8, 23) }, // LoL 16.19, Sep 23 2026
]

// Set release = start of its first patch (epoch ms).
export const SET_RELEASE_MS = SET_PATCH_SCHEDULE[0].startsAt

// Riot queue id for Double Up. Set 18 payloads report tft_game_type "standard"
// for Double Up games, so the queue id is the reliable signal (see riotMatchCompat.js).
export const DOUBLE_UP_QUEUE_ID = 1160
