import { readFileSync } from 'node:fs'
import { CURRENT_SET } from '../constants/game.js'

// Ability values and icons extracted from the local TFT (Unreal) client by
// scripts/tft_client/extract.py. Since Set 18 the League-side files
// CommunityDragon exports carry only placeholder spells for units; the real
// numbers live in the Unreal client's data assets. Per unit:
//   { icon: '/assets/abilities/set18/DA_18_Ahri.png',
//     tokens: { MagicDamageCalc1: [455, 685, 3500] },   // evaluated calculations
//     rows: { HexRadius: [3, 3, 3], … },               // the unit's curve-table rows
//     formats: { SpellAS: 'percentMinusOne' } }        // display hints from the client tooltip
// Star arrays are [1★, 2★, 3★].
export const loadClientAbilityData = (setNumber = CURRENT_SET) => {
  try {
    const url = new URL(`../data/abilityData.set${setNumber}.json`, import.meta.url)
    return JSON.parse(readFileSync(url, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Client ability data for set ${setNumber} unreadable:`, err.message)
    return {}
  }
}

// Same matching as the client tokenizer: case/punctuation-insensitive, with an
// optional "Modified" prefix on the description side.
const tokenKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

const clean = (n) => Math.round(n * 1e6) / 1e6

// The client tooltip's format hints, as tokenizer parts: "percent" shows the
// value as a percentage even when ≥ 1 (100%); "percentMinusOne" shows a
// multiplier as its bonus (attack speed 1.85 → 85%).
const formatPart = (values, format) => {
  if (format === 'percentMinusOne') return { values: [0, ...values.map(v => clean(v - 1))], percent: true }
  if (format === 'percent') return { values: [0, ...values], percent: true }
  return { values: [0, ...values] }
}

// Tooltip tokens the client data can fill, in the tokenizer's calculation
// shape: { [token]: [{ values: [_, 1★, 2★, 3★], percent? }] }. Descriptions
// name either a calculation (@MagicDamageCalc1@) or a curve row directly
// (@HexRadius@); a calculation wins over a row of the same name. A token that
// carries its own scaling (@Ratio*100@%) keeps the raw value.
export const resolveClientTokens = (desc, entry) => {
  if (!entry) return {}
  const byKey = new Map()
  for (const [name, values] of Object.entries(entry.rows || {})) byKey.set(tokenKey(name), values)
  for (const [name, values] of Object.entries(entry.tokens || {})) byKey.set(tokenKey(name), values)
  const formats = new Map(Object.entries(entry.formats || {}).map(([name, f]) => [tokenKey(name), f]))

  const out = {}
  for (const m of String(desc || '').matchAll(/@([^@]+)@/g)) {
    const token = m[1].split('*')[0]
    if (token.startsWith('%') || token in out) continue
    let key = tokenKey(token)
    if (!byKey.has(key)) key = key.replace(/^modified/, '')
    const values = byKey.get(key)
    if (!Array.isArray(values) || values.length !== 3) continue
    const format = m[1].includes('*') ? null : formats.get(key)
    out[token] = [formatPart(values, format)]
  }
  return out
}
