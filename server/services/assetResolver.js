import axios from 'axios'
import { readFileSync } from 'node:fs'
import { CURRENT_SET } from '../constants/game.js'
import { loadClientAbilityData, resolveClientTokens } from './clientAbilityData.js'
import { buildClientItem, loadClientItemData } from './clientItemData.js'
import { evaluateCalculations, pickAbilitySpell } from './spellCalculations.js'

// Riot apiNames stopped following one prefix scheme in Set 18. Sets up to 17 used
// "TFT17_Ahri"; Set 18 uses "DA_" with the set number anywhere in the name
// ("DA_18_Xayah", "DA_Vi18", "DA_Gromp18_AP", "DA_Primal18"), and match-v1
// character_id / trait name / itemNames use these same apiNames. Only used by the
// Data Dragon fallback; the CDragon path selects the set entry by number instead.
export const isCurrentSetId = (id, setNumber = CURRENT_SET) => {
  if (!id) return false
  if (id.startsWith(`TFT${setNumber}_`)) return true
  return id.startsWith('DA_') && new RegExp(`(^|[^0-9])${setNumber}([^0-9]|$)`).test(id)
}

// CDragon setData holds several entries per set number (base, _PAIRS, _PVEMODE,
// events). Prefer the Double Up variant, then the base set, then any entry that
// isn't a PvE or event mode.
export const selectSetEntry = (setData, setNumber = CURRENT_SET) => {
  if (!Array.isArray(setData)) return null
  const byMutator = (m) => setData.find(s => s.mutator === m)
  return byMutator(`TFTSet${setNumber}_PAIRS`)
    || byMutator(`TFTSet${setNumber}`)
    || setData.find(s => s.number === setNumber && !/PVEMODE|Event/i.test(s.mutator || ''))
    || null
}

// Real, playable units carry at least one trait; golems, training dummies,
// anvils and loot chests listed alongside them in setData have none.
export const selectSetUnits = (setEntry) =>
  (setEntry?.champions || []).filter(c => c.apiName && (c.traits || []).length > 0)

// CDragon emits some variable names as FNV-1a 32-bit hashes of the lowercased
// name ("{7a9d7f0e}" = fnv1a("essenceperdeath")) when it can't resolve the
// field name. The descriptions still reference the readable @Token@ names, so
// hash each token and map the hashed keys back. Unmatched hashes pass through.
const fnv1a = (str) => {
  let hash = 0x811c9dc5
  for (const ch of str.toLowerCase()) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
const HASHED_NAME_RE = /^\{([0-9a-f]{8})\}$/

export const unhashVariables = (vars, desc) => {
  const list = toNameValueArray(vars)
  if (!list.some(v => HASHED_NAME_RE.test(v.name))) return list
  const byHash = new Map()
  for (const m of String(desc || '').matchAll(/@([^@*%]+)/g)) {
    byHash.set(fnv1a(m[1].trim()), m[1].trim())
  }
  return list.map(v => {
    const hashed = HASHED_NAME_RE.exec(v.name)
    const name = hashed && byHash.get(hashed[1])
    return name ? { ...v, name } : v
  })
}

let championMap = new Map()
let itemMap = new Map()
let augmentMap = new Map()
let traitMap = new Map()
let ddVersion = null

// Community Dragon raw paths come in a few shapes across data versions:
//   /lol-game-data/assets/ASSETS/Characters/.../foo.tex
//   ASSETS/Characters/.../foo.tex
//   assets/characters/.../foo.dds
// The public CDN mirrors them under .../latest/game/assets/... and serves
// .png conversions in place of the raw .tex/.dds files.
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/game/'

// Startup awaits these CDN fetches before the server marks itself ready. axios
// defaults to no timeout, so a stalled connection (CDragon is occasionally flaky)
// would hang the await forever — every /api route then 503s indefinitely because
// `initialized` never flips. A bounded timeout turns a stall into a rejection the
// startup .catch() can absorb, so the server comes up (degraded) instead of wedging.
const ASSET_FETCH_TIMEOUT_MS = 15_000

// CDragon returns effect/variable collections as either an array [{name,value}]
// or a plain object {StatName: value}. Normalize both to [{name, value}].
const toNameValueArray = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') return Object.entries(raw).map(([name, value]) => ({ name, value }))
  return []
}
const toCDragonUrl = (rawPath) => {
  // CDragon writes the literal string "None" for a missing icon (every Set 18
  // ability but Tristana's) — treat it as absent rather than linking assets/none.
  if (!rawPath || rawPath === 'None') return ''
  let p = rawPath.toLowerCase().replace(/^\/+/, '')
  p = p.replace(/^lol-game-data\/assets\//, '')
  if (!p.startsWith('assets/')) p = `assets/${p}`
  p = p.replace(/\.(tex|dds)$/, '.png')
  return `${CDRAGON_BASE}${p}`
}

// Hand-curated ability values for sets CDragon ships without them (see
// data/abilityOverrides.set18.json and scripts/scaffoldAbilityOverrides.js).
export const loadAbilityOverrides = (setNumber = CURRENT_SET) => {
  try {
    const url = new URL(`../data/abilityOverrides.set${setNumber}.json`, import.meta.url)
    return JSON.parse(readFileSync(url, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Ability overrides for set ${setNumber} unreadable:`, err.message)
    return {}
  }
}

// Override token entries are hand-typed, so accept shorthand: a bare array of
// star values ([160, 240, 360] or [10]), { values, percent }, or an array of
// those. null = not filled in yet. Normalized to the tokenizer's
// [{ values: [_, 1★, 2★, 3★], percent? }] shape.
const toStarValues = (vals) => {
  if (!Array.isArray(vals) || vals.length === 0 || vals.some(v => typeof v !== 'number')) return null
  if (vals.length === 1) return [0, vals[0], vals[0], vals[0]]
  if (vals.length === 3) return [0, ...vals]
  return vals.length === 4 ? vals : null
}
export const normalizeOverrideToken = (entry) => {
  if (entry == null) return null
  if (Array.isArray(entry) && entry.every(v => typeof v === 'number')) entry = { values: entry }
  const parts = (Array.isArray(entry) ? entry : [entry]).map(p => {
    const values = toStarValues(p?.values)
    if (!values) return null
    return p.percent ? { values, percent: true } : { values }
  })
  return parts.length > 0 && parts.every(Boolean) ? parts : null
}

const DD_SPELL_ICON_BASE = 'https://ddragon.leagueoflegends.com/cdn'
const hasValues = (calcs) => calcs && Object.keys(calcs).length > 0

// Resolves a CDragon champion's ability for the client. Token values come from
// the unit's character bin when CDragon has real data, then from the values
// extracted from the Unreal client (Set 18+: what the game itself uses, so they
// win over the bin), then from the curated override for anything still
// missing. Icon: the client's ability art, else CDragon's, else the League
// spell icon named in the override, else the unit portrait.
export const buildAbility = (champ, { bin = null, client = null, override = null, ddVersion = null, portraitUrl = '' } = {}) => {
  if (!champ?.ability) return null
  // <rules>...</rules> blocks are CDragon tooltip rule annotations — drop them.
  const desc = (champ.ability.desc || '').replace(/<rules>[\s\S]*?<\/rules>/gi, '')

  const evaluated = evaluateCalculations(pickAbilitySpell(bin), champ.stats) || {}
  // Calculation names can be FNV-1a hashes; restore them from the desc tokens.
  const calculations = Object.fromEntries(
    unhashVariables(evaluated, desc).map(({ name, value }) => [name, value]),
  )
  const fromBin = Object.keys(calculations).length > 0
  const clientTokens = resolveClientTokens(desc, client)
  Object.assign(calculations, clientTokens)

  const supplied = new Set(Object.keys(calculations).map(k => k.toLowerCase()))
  const shadowed = []
  for (const [token, entry] of Object.entries(override?.tokens || {})) {
    const parts = normalizeOverrideToken(entry)
    if (!parts) continue
    if (supplied.has(token.toLowerCase())) shadowed.push(token)
    else calculations[token] = parts
  }

  const cdIcon = toCDragonUrl(champ.ability.icon)
  const spellIcon = override?.iconSpell && ddVersion
    ? `${DD_SPELL_ICON_BASE}/${ddVersion}/img/spell/${override.iconSpell}`
    : ''

  const ability = {
    name: champ.ability.name || '',
    desc,
    iconUrl: client?.icon || cdIcon || spellIcon || portraitUrl,
    variables: unhashVariables(champ.ability.variables, desc),
  }
  if (hasValues(calculations)) ability.calculations = calculations
  // `shadowed` = override tokens now supplied by CDragon or the client data
  // (stale after a patch — prune them).
  return { ability, fromBin, fromClient: Object.keys(clientTokens).length > 0, shadowed }
}

// True when every @Token@ in the description has a value to show. Mirrors the
// client tokenizer's lookup (case/punctuation-insensitive, "Modified" prefix
// optional); %-prefixed tokens are icons, not values.
const tokenKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
export const isAbilityResolved = (ability) => {
  const known = new Set([
    ...Object.keys(ability?.calculations || {}),
    ...(ability?.variables || []).map(v => v.name),
  ].map(tokenKey))
  const tokens = [...String(ability?.desc || '').matchAll(/@([^@]+)@/g)]
    .map(m => m[1].split('*')[0])
    .filter(t => !t.startsWith('%'))
  return tokens.every(t => known.has(tokenKey(t)) || known.has(tokenKey(t).replace(/^modified/, '')))
}

// Fetch each unit's character bin (holds mSpellCalculations). A handful of
// requests in parallel; any failure just leaves that unit without bin data.
// One overall deadline so a stalled CDN can't hold startup for ~74 timeouts.
const BIN_FETCH_CONCURRENCY = 8
export const fetchCharacterBins = async (apiNames) => {
  const bins = new Map()
  const queue = [...apiNames]
  const deadline = Date.now() + ASSET_FETCH_TIMEOUT_MS
  const worker = async () => {
    while (queue.length > 0) {
      const apiName = queue.shift()
      const remaining = deadline - Date.now()
      if (remaining <= 0) return
      try {
        const url = `${CDRAGON_BASE}characters/${apiName.toLowerCase()}.cdtb.bin.json`
        const { data } = await axios.get(url, { timeout: remaining })
        bins.set(apiName, data)
      } catch {
        // Missing or unreachable bin — the unit falls back to overrides.
      }
    }
  }
  await Promise.all(Array.from({ length: BIN_FETCH_CONCURRENCY }, worker))
  return bins
}

// Classifies an item using Community Dragon metadata when available.
// DD's tft-item.json only exposes id/name/image — no composition data —
// so we join on apiName to get `composition` and tags from CDragon.
const classifyItem = (ddItem, cdItem) => {
  const name = ddItem.name || ''
  const composition = Array.isArray(cdItem?.composition) ? cdItem.composition : []
  const tags = cdItem?.tags || []
  const apiName = cdItem?.apiName || ddItem.id || ''

  if (/tactician/i.test(name)) return 'other'
  if (/^Radiant\s/i.test(name)) return 'radiant'
  if (/artifact/i.test(name) || /artifact/i.test(apiName)) return 'artifact'
  if (/emblem/i.test(name)) return 'emblem'
  if (composition.length === 2) return 'craftable'
  // Components collapse into 'other' so the UI's five tabs cover everything.
  return 'other'
}

export const fetchAndCacheAssets = async () => {
  console.log(`Fetching static assets (set ${CURRENT_SET}) from Data Dragon and Community Dragon...`)

  // Step 1: Get latest Data Dragon version
  const versions = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json', { timeout: ASSET_FETCH_TIMEOUT_MS }).then(r => r.data)
  ddVersion = versions[0]
  console.log(`Data Dragon version: ${ddVersion}`)

  // Step 2: Fetch DD champion/item + Community Dragon data in parallel
  const [champData, itemData, cdData] = await Promise.all([
    axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/tft-champion.json`, { timeout: ASSET_FETCH_TIMEOUT_MS }).then(r => r.data),
    axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/tft-item.json`, { timeout: ASSET_FETCH_TIMEOUT_MS }).then(r => r.data),
    axios.get('https://raw.communitydragon.org/latest/cdragon/tft/en_us.json', { timeout: ASSET_FETCH_TIMEOUT_MS }).then(r => r.data).catch(() => null),
  ])

  // Step 3: Build champion map from Community Dragon (has traits + icons)
  // Community Dragon setData has per-set champion lists with trait data
  championMap.clear()

  let cdChampions = []
  let cdTraits = []
  let setItemAllowlist = null // Set<apiName> — items relevant to the current set
  const setEntry = selectSetEntry(cdData?.setData)
  if (setEntry) {
    cdChampions = selectSetUnits(setEntry)
    cdTraits = setEntry.traits || []
    if (Array.isArray(setEntry.items) && setEntry.items.length > 0) {
      setItemAllowlist = new Set(setEntry.items)
    }
  }

  // Top-level cdData.items has full metadata (composition, tags) for every item.
  // Key by BOTH apiName and String(id) — CDragon TFT items use numeric strings as
  // apiName for many items (matching DD's numeric item.id), so both lookups are needed.
  const cdItemMap = new Map()
  const cdItemByApiName = new Map()
  for (const it of (cdData?.items || [])) {
    if (it.apiName != null) cdItemMap.set(String(it.apiName), it)
    if (it.id != null) cdItemMap.set(String(it.id), it)
    if (it.apiName != null) cdItemByApiName.set(it.apiName, it)
  }

  if (cdChampions.length > 0) {
    // en_us.json leaves calculated tooltip tokens (@MagicDamageCalc1@)
    // unresolved; their formulas live in each unit's character bin.
    const bins = await fetchCharacterBins(cdChampions.map(c => c.apiName))
    const clientData = loadClientAbilityData()
    const overrides = loadAbilityOverrides()
    const coverage = { resolved: 0, fromBin: 0, fromClient: 0, fromOverride: 0 }
    const shadowedTokens = []

    // Use Community Dragon data (has traits and better icons)
    for (const champ of cdChampions) {
      const iconUrl = toCDragonUrl(champ.squareIcon || champ.tileIcon)

      const built = buildAbility(champ, {
        bin: bins.get(champ.apiName),
        client: clientData[champ.apiName],
        override: overrides[champ.apiName],
        ddVersion,
        portraitUrl: iconUrl,
      })
      const ability = built?.ability || null
      if (built) {
        if (built.fromBin) coverage.fromBin++
        else if (built.fromClient) coverage.fromClient++
        else if (ability.calculations) coverage.fromOverride++
        if (isAbilityResolved(ability)) coverage.resolved++
        for (const t of built.shadowed) shadowedTokens.push(`${champ.apiName}.${t}`)
      }

      const stats = champ.stats ? {
        mana: champ.stats.mana ?? 100,
        initialMana: champ.stats.initialMana ?? 0,
        armor: champ.stats.armor ?? 0,
        magicResist: champ.stats.magicResist ?? 0,
        attackSpeed: champ.stats.attackSpeed ?? 0,
      } : null

      championMap.set(champ.apiName, {
        id: champ.apiName,
        name: champ.name || champ.characterName,
        cost: champ.cost || 1,
        traits: champ.traits || [],
        iconUrl,
        ability,
        stats,
      })
    }
    const clientBuild = clientData._meta?.branch ? ` (${clientData._meta.branch}, extracted ${clientData._meta.extractedAt})` : ''
    console.log(
      `Abilities: ${coverage.resolved}/${cdChampions.length} units fully resolved ` +
      `(values from CDragon bins: ${coverage.fromBin}, from TFT client data${clientBuild}: ${coverage.fromClient}, ` +
      `from curated overrides only: ${coverage.fromOverride})`,
    )
    if (shadowedTokens.length > 0) {
      console.warn(`Ability overrides now supplied by CDragon or client data — prune from abilityOverrides.set${CURRENT_SET}.json: ${shadowedTokens.join(', ')}`)
    }
  } else {
    // Fallback: use Data Dragon, filter by ID prefix (no trait data available here)
    const champEntries = Object.values(champData.data || {})
    for (const champ of champEntries) {
      if (!isCurrentSetId(champ.id)) continue
      const iconUrl = champ.image
        ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/tft-champion/${champ.image}`
        : ''
      championMap.set(champ.id, {
        id: champ.id,
        name: champ.name,
        cost: champ.cost || champ.tier || 1,
        traits: [],
        iconUrl,
      })
    }
  }
  console.log(`Loaded ${championMap.size} champions for set ${CURRENT_SET}`)

  // Step 4: Build item map — DD for icons, CDragon for categorization.
  // Restrict to items the current set actually uses (via setEntry.items).
  itemMap.clear()
  const clientItems = loadClientItemData()
  let itemsFromClient = 0
  const seenNames = new Set()
  // Dedupe key ignores punctuation/case: Riot names some Set 18 copies slightly
  // differently ("Warmogs Armor" vs legacy "Warmog's Armor").
  const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
  // The set allowlist carries both legacy and current-set copies of most items
  // under the same display name (TFT_Item_Deathblade and DA_Deathblade), and
  // de-duplication below keeps the first one seen. Set 18 match payloads report
  // the DA_ ids, so visit current-set items first or match items won't resolve.
  // DD keys current-set items by path ("TFTSet18/Set18_Items/DA_InfinityEdge");
  // the id itself doesn't always carry the set number.
  const isCurrentSetItem = ([key]) => key.startsWith(`TFTSet${CURRENT_SET}/`)
  const itemEntries = Object.entries(itemData.data || {})
    .sort((a, b) => Number(isCurrentSetItem(b)) - Number(isCurrentSetItem(a)))
    .map(([, item]) => item)
  for (const item of itemEntries) {
    if (!item.name) continue
    if (setItemAllowlist && !setItemAllowlist.has(item.id)) continue
    if (seenNames.has(nameKey(item.name))) continue

    const imgFile = typeof item.image === 'object' ? item.image?.full : item.image
    const iconUrl = imgFile
      ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/tft-item/${imgFile}`
      : ''

    const cdItem = cdItemMap.get(String(item.id))
    const category = classifyItem(item, cdItem)
    const nameLower = item.name.toLowerCase()

    // Filter placeholder/junk items by category and name
    if (category === 'artifact' && (nameLower === 'artifact item' || nameLower === 'god artifact anvil')) continue
    if (category === 'emblem' && nameLower === 'random emblem') continue
    if (category === 'radiant' && nameLower === 'radiant item lucky chest') continue
    if (category === 'other' && /gold|xp|quest|blessing|scissors|reroll|cost|anvil|dummy|remover|boon|mystery|mecha|dice|mini|lovers|shared|reforger|mode|better|upgrade|scuttle|armory|sentinel|seat|humility|orb|craft|slot|hard|cash|blood|smithing|damage amp|do you|sacrifice|roll|duplicator|critical hit|support|super|enemies|striker|semi|taunt|ace|reinforced|finalist|divine|hex|changing|chest|salvager|pain|augment|increase|pengu|missing|star|component|item/i.test(item.name)) continue
    // Drop "+" / "++" upgraded variants — base item carries the same display name.
    if (/\+$/.test(item.name)) continue
    // Drop items with any digit in the name (placeholder/test variants).
    if (/\d/.test(item.name)) continue

    // CDragon composition entries are apiName strings — resolve to the DD item IDs
    // so the client can look up component icons from the items array it already has.
    // Legacy items have numeric CDragon ids; Set 18 DA_ items have id null and a DD
    // id equal to their apiName.
    const compositionIds = (cdItem?.composition || [])
      .map(apiName => {
        const comp = cdItemByApiName.get(apiName)
        return comp ? String(comp.id ?? comp.apiName) : null
      })
      .filter(Boolean)

    let effects = unhashVariables(cdItem?.effects, cdItem?.desc)
    // CDragon stores AD for these radiant items as a fraction (e.g. 0.50) rather
    // than a flat value — multiply by 100 to get the correct in-game number.
    if (item.name === 'Radiant Deathblade' || item.name === 'Silvermere Dawn') {
      effects = effects.map(e =>
        (e.name === 'AD' || e.name === 'AttackDamage') ? { ...e, value: e.value * 100 } : e
      )
    }
    // Set 18 DA_ items have no CDragon description; the TFT client's own
    // tooltip (stat line + text) is what the game shows, so it wins.
    const fromClient = buildClientItem(clientItems[item.id])
    if (fromClient) itemsFromClient++

    seenNames.add(nameKey(item.name))
    itemMap.set(String(item.id), {
      id: String(item.id),
      name: item.name,
      iconUrl,
      category,
      desc: fromClient ? fromClient.desc : (cdItem?.desc || ''),
      effects: fromClient ? fromClient.effects : effects,
      ...(fromClient && { calculations: fromClient.calculations }),
      composition: compositionIds,
      apiName: cdItem?.apiName || '',
    })
  }
  console.log(`Loaded ${itemMap.size} items (${itemsFromClient} with TFT client tooltips)`)

  // Step 5: Build augment map from Community Dragon
  augmentMap.clear()
  if (cdData?.augments) {
    for (const aug of cdData.augments) {
      if (!aug.iconPath) continue
      const iconUrl = toCDragonUrl(aug.iconPath)
      augmentMap.set(aug.apiName, {
        id: aug.apiName,
        name: aug.name,
        iconUrl,
      })
    }
    console.log(`Loaded ${augmentMap.size} augments`)
  }

  // Step 6: Build trait map from Community Dragon set entry
  traitMap.clear()
  for (const trait of cdTraits) {
    const iconUrl = toCDragonUrl(trait.icon)
    traitMap.set(trait.apiName, {
      id: trait.apiName,
      name: trait.name,
      iconUrl,
      desc: trait.desc || '',
      effects: (trait.effects || []).map(e => ({
        minUnits: e.minUnits,
        style: e.style,
        variables: unhashVariables(e.variables, trait.desc),
      })),
    })
  }
  console.log(`Loaded ${traitMap.size} traits for set ${CURRENT_SET}`)
}

export const getChampionIcon = (id) => championMap.get(id)?.iconUrl || ''
export const getItemIcon = (id) => itemMap.get(String(id))?.iconUrl || ''
export const getAugmentIcon = (id) => augmentMap.get(id)?.iconUrl || ''
export const getChampionData = (id) => championMap.get(id) || null
export const getAllChampions = () => Array.from(championMap.values())
export const getAllItems = () => Array.from(itemMap.values())
export const getTraitData = (id) => traitMap.get(id) || null
export const getAllTraits = () => Array.from(traitMap.values())
