// Creates / refreshes data/abilityOverrides.set<N>.json — the hand-curated
// ability values used while CommunityDragon ships a set without them (Set 18:
// every DA_ unit's spell data is a placeholder). Most values now come from the
// TFT client itself (data/abilityData.set<N>.json, written by
// scripts/tft_client/extract.py — run that first).
//
// For each unit it lists every @Token@ its tooltip needs that neither CDragon
// nor the client data resolve, as null, for you to fill in from the in-game
// tooltip:
//   "MagicDamageCalc1": [160, 240, 360]      ← 1★/2★/3★
//   "PercentManaPerSecond": [10]             ← same at every star level
//   "SomeRatio": { "values": [0.2], "percent": true }   ← shown as 20%
// Type numbers as the tooltip shows them. Where the text already has a "%"
// after the token ("@WoundLevel@% Wound"), enter 33, not 0.33 — values below 1
// are rendered as percentages and would print "33%%".
// Values already filled in are kept. `iconSpell` is the Data Dragon spell icon
// filename shown on the unit card (defaults to the League champion's R; edit to
// pick a different spell, or null for the unit portrait).
//
// Run from the server/ directory:  node scripts/scaffoldAbilityOverrides.js
import axios from 'axios'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CURRENT_SET } from '../constants/game.js'
import {
  buildAbility,
  fetchCharacterBins,
  isAbilityResolved,
  normalizeOverrideToken,
  selectSetEntry,
  selectSetUnits,
} from '../services/assetResolver.js'
import { loadClientAbilityData } from '../services/clientAbilityData.js'

const OUT = new URL(`../data/abilityOverrides.set${CURRENT_SET}.json`, import.meta.url)
const TIMEOUT = { timeout: 60_000 }
const R_SLOT = 3

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
// "Lux (Blackthorn)" → "Lux"
const baseName = (name) => String(name || '').replace(/\s*\(.*\)\s*$/, '')

const readExisting = () => {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

// Keep the file hand-editable: star arrays on one line.
const format = (obj) =>
  JSON.stringify(obj, null, 2).replace(/\[\s+([-\d.e,\s]+?)\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(', ')}]`) + '\n'

async function main() {
  const [cdData, versions] = await Promise.all([
    axios.get('https://raw.communitydragon.org/latest/cdragon/tft/en_us.json', TIMEOUT).then(r => r.data),
    axios.get('https://ddragon.leagueoflegends.com/api/versions.json', TIMEOUT).then(r => r.data),
  ])
  const ddVersion = versions[0]
  const championFull = await axios
    .get(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/championFull.json`, TIMEOUT)
    .then(r => r.data.data)
  const lolByName = new Map(Object.values(championFull).map(c => [key(c.name), c]))

  const units = selectSetUnits(selectSetEntry(cdData.setData))
  if (units.length === 0) throw new Error(`No units found for set ${CURRENT_SET}`)
  const bins = await fetchCharacterBins(units.map(u => u.apiName))
  const clientData = loadClientAbilityData()
  const existing = readExisting()

  const out = {}
  let tokensTotal = 0
  let tokensFilled = 0
  let unitsResolved = 0
  for (const unit of units) {
    const prev = existing[unit.apiName] || {}
    // What CDragon and the client data resolve on their own, without any override.
    const client = clientData[unit.apiName]
    const { ability } = buildAbility(unit, { bin: bins.get(unit.apiName), client })
    const known = new Set([
      ...Object.keys(ability.calculations || {}),
      ...ability.variables.map(v => v.name),
    ].map(key))

    const tokens = {}
    for (const m of ability.desc.matchAll(/@([^@]+)@/g)) {
      const token = m[1].split('*')[0]
      if (token.startsWith('%') || token in tokens) continue
      const k = key(token)
      if (known.has(k) || known.has(k.replace(/^modified/, ''))) continue
      tokens[token] = prev.tokens?.[token] ?? null
      tokensTotal++
      if (normalizeOverrideToken(tokens[token])) tokensFilled++
    }

    const lol = lolByName.get(key(baseName(unit.name)))
    const defaultIcon = lol?.spells?.[R_SLOT]?.image?.full ?? null
    out[unit.apiName] = {
      _unit: `${unit.name} (${unit.cost}-cost) — ${ability.name}`,
      iconSpell: 'iconSpell' in prev ? prev.iconSpell : defaultIcon,
      tokens,
    }

    const withOverride = buildAbility(unit, { bin: bins.get(unit.apiName), client, override: out[unit.apiName] }).ability
    if (isAbilityResolved(withOverride)) unitsResolved++
  }

  writeFileSync(OUT, format(out))
  const withIcon = Object.values(out).filter(u => u.iconSpell).length
  console.log(`Wrote ${units.length} units to ${fileURLToPath(OUT)}`)
  console.log(`  bins fetched: ${bins.size}/${units.length}`)
  console.log(`  tokens filled: ${tokensFilled}/${tokensTotal}`)
  console.log(`  units fully resolved: ${unitsResolved}/${units.length}`)
  console.log(`  units with a League spell icon: ${withIcon}/${units.length} (rest use the portrait)`)
}

main().catch(err => {
  console.error('Scaffold failed:', err.message)
  process.exitCode = 1
})
