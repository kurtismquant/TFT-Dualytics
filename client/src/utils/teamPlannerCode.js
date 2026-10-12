// In-game Team Planner share codes: a version prefix, 10 champion slots, then
// "TFTSet<n>". Each slot is a champion's team_planner_code (from CDragon's
// tftchampions-teamplanner.json, served as champion.plannerCode) in hex, zeros
// when empty. Sets up to 17 used prefix "01" with 2 hex digits per slot; codes
// above 0xFF (Set 18 runs 0x3E9-0x43D) use prefix "02" with 3 digits.
// e.g. Gromp (1026) + Lux (1029): "02402405000000000000000000000000TFTSet18".
import { CURRENT_SET } from '../constants/game.js'

export const TEAM_PLANNER_SLOTS = 10

// `units` are champion objects. A unit's code is its plannerCode, else its
// formOf base's (builder roster Lux forms) looked up in `championsById`. Units
// the planner doesn't know (summons, dummies) are skipped; a board of more
// than 10 keeps its 10 priciest. Returns null when no unit has a code (e.g.
// assets cached before codes were served).
export function encodeTeamPlannerCode(units, championsById, setNumber = CURRENT_SET) {
  const entries = []
  for (const unit of units || []) {
    const code = unit?.plannerCode ?? championsById?.get(unit?.formOf)?.plannerCode
    if (!Number.isInteger(code) || code <= 0 || entries.some(entry => entry.code === code)) continue
    entries.push({ code, cost: unit.cost || 0 })
  }
  if (entries.length === 0) return null
  const kept = entries.length > TEAM_PLANNER_SLOTS
    ? [...entries].sort((a, b) => b.cost - a.cost).slice(0, TEAM_PLANNER_SLOTS)
    : entries
  const codes = kept.map(entry => entry.code)
  const digits = codes.some(code => code > 0xff) ? 3 : 2
  const slots = Array.from({ length: TEAM_PLANNER_SLOTS }, (_, i) => (codes[i] ?? 0).toString(16).padStart(digits, '0'))
  return `0${digits === 3 ? 2 : 1}${slots.join('')}TFTSet${setNumber}`
}

// For boards rendered from resolveUnits() output ({ champion, ... }).
export const teamCodeForResolvedUnits = resolvedUnits =>
  encodeTeamPlannerCode((resolvedUnits || []).map(unit => unit.champion))
