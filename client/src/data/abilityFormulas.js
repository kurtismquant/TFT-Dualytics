// Per-champion ability token formulas.
// CDragon ability descriptions reference @TokenName@ that don't always map
// 1:1 to a variable. This registry maps (championId, tokenName) → a function
// that emits an ordered list of value+icon segments. The tokenizer in
// UnitCard.jsx consults this registry first; on miss it falls back to the
// generic findVariable heuristic, and drops the token if that misses too.
//
// Champion IDs are matched after normalization (lowercase, strip non-alnum)
// so 'DA_18_Kha\'Zix', 'DA_18_KhaZix', 'DA_18_Khazix' all collapse to the
// same key.
//
// Set 18 note: CDragon currently ships Set 18 abilities with empty `variables`
// and computed tokens (@PhysicalDamageCalc1@, @ShieldCalc1@, …), so there is
// nothing to build formulas from yet. Once values are published, add entries as:
//
//   DA_18_Caitlyn: {
//     PhysicalDamageCalc1: ({ vars, stats }) => [
//       { values: <[_, 1★, 2★, 3★] array from vars>, icon: 'ad' },
//     ],
//   },
//
// where each segment is { values, icon?, percent? } | { text } | { iconOnly }.

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const RAW_FORMULAS = {}

// Build a normalized lookup so champion ID variants (Kha'Zix / KhaZix /
// Khazix) all resolve to the same registry entry.
const FORMULAS = Object.fromEntries(
  Object.entries(RAW_FORMULAS).map(([id, tokens]) => [norm(id), tokens]),
)

// Look up a formula. Tries exact normalized match first.
export function getFormula(championId, tokenName) {
  const champKey = norm(championId)
  const champEntry = FORMULAS[champKey]
  if (!champEntry) return null
  const tokenKey = Object.keys(champEntry).find(k => norm(k) === norm(tokenName))
  return tokenKey ? champEntry[tokenKey] : null
}
