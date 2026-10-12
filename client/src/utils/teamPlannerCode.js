// In-game Team Planner share codes: a version prefix, 10 champion slots, then
// "TFTSet<n>". Each slot is a champion's team_planner_code (from CDragon's
// tftchampions-teamplanner.json, served as champion.plannerCode) in hex, zeros
// when empty. Sets up to 17 used prefix "01" with 2 hex digits per slot; codes
// above 0xFF (Set 18 runs 0x3E9-0x43D) use prefix "02" with 3 digits.
// e.g. Gromp (1026) + Lux (1029): "02402405000000000000000000000000TFTSet18".

export const TEAM_PLANNER_SLOTS = 10

// `units` are roster entries. Trait forms (Lux (Coven)) aren't in the planner,
// so a form uses its base unit's code (formOf), looked up in `championsById`
// (the full asset list, which still has base Lux). Returns null when a unit
// has no code (e.g. assets cached before codes were served) or it won't fit.
export function encodeTeamPlannerCode(units, championsById, setNumber) {
  const codes = []
  for (const unit of units) {
    const code = unit?.plannerCode ?? championsById?.get(unit?.formOf)?.plannerCode
    if (!Number.isInteger(code) || code <= 0) return null
    if (!codes.includes(code)) codes.push(code)
  }
  if (codes.length === 0 || codes.length > TEAM_PLANNER_SLOTS) return null
  const digits = codes.some(code => code > 0xff) ? 3 : 2
  const slots = Array.from({ length: TEAM_PLANNER_SLOTS }, (_, i) => (codes[i] ?? 0).toString(16).padStart(digits, '0'))
  return `0${digits === 3 ? 2 : 1}${slots.join('')}TFTSet${setNumber}`
}
