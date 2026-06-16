import axios from 'axios'
import { CURRENT_SET } from '../constants/game.js'

// Data Dragon champions for the current set use this ID prefix
const SET_ID_PREFIX = `TFT${CURRENT_SET}_`

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
  if (!rawPath) return ''
  let p = rawPath.toLowerCase().replace(/^\/+/, '')
  p = p.replace(/^lol-game-data\/assets\//, '')
  if (!p.startsWith('assets/')) p = `assets/${p}`
  p = p.replace(/\.(tex|dds)$/, '.png')
  return `${CDRAGON_BASE}${p}`
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
  if (cdData?.setData) {
    // Find the set entry for the current set number
    const setEntry = cdData.setData.find(s =>
      s.champions?.some(c => c.apiName?.startsWith(SET_ID_PREFIX))
    )
    if (setEntry) {
      cdChampions = setEntry.champions.filter(c => c.apiName?.startsWith(SET_ID_PREFIX))
      cdTraits = (setEntry.traits || []).filter(t => t.apiName?.startsWith(SET_ID_PREFIX))
      if (Array.isArray(setEntry.items) && setEntry.items.length > 0) {
        setItemAllowlist = new Set(setEntry.items)
      }
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
    // Use Community Dragon data (has traits and better icons)
    for (const champ of cdChampions) {
      const iconUrl = toCDragonUrl(champ.squareIcon || champ.tileIcon)

      // CDragon ability variables can be returned as either an array of
       // {name, value} objects or as an object map {VarName: [0, s1, s2, s3]}.
      // Normalize to the array form the client tokenizer expects.
      // <rules>...</rules> blocks are CDragon tooltip rule annotations — drop them.
      const rawDesc = champ.ability?.desc || ''
      const cleanedDesc = rawDesc.replace(/<rules>[\s\S]*?<\/rules>/gi, '')
      const ability = champ.ability ? {
        name: champ.ability.name || '',
        desc: cleanedDesc,
        iconUrl: toCDragonUrl(champ.ability.icon),
        variables: toNameValueArray(champ.ability.variables),
      } : null

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
  } else {
    // Fallback: use Data Dragon, filter by ID prefix (no trait data available here)
    const champEntries = Object.values(champData.data || {})
    for (const champ of champEntries) {
      if (!champ.id.startsWith(SET_ID_PREFIX)) continue
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
  const seenNames = new Set()
  const itemEntries = Object.values(itemData.data || {})
  for (const item of itemEntries) {
    if (!item.name) continue
    if (setItemAllowlist && !setItemAllowlist.has(item.id)) continue
    if (seenNames.has(item.name)) continue

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

    // CDragon composition entries are apiName strings — resolve to numeric IDs
    // so the client can look up component icons from the items array it already has.
    const compositionIds = (cdItem?.composition || [])
      .map(apiName => {
        const comp = cdItemByApiName.get(apiName)
        return comp ? String(comp.id) : null
      })
      .filter(Boolean)

    let effects = toNameValueArray(cdItem?.effects)
    // CDragon stores AD for these radiant items as a fraction (e.g. 0.50) rather
    // than a flat value — multiply by 100 to get the correct in-game number.
    if (item.name === 'Radiant Deathblade' || item.name === 'Silvermere Dawn') {
      effects = effects.map(e =>
        (e.name === 'AD' || e.name === 'AttackDamage') ? { ...e, value: e.value * 100 } : e
      )
    }

    seenNames.add(item.name)
    itemMap.set(String(item.id), {
      id: String(item.id),
      name: item.name,
      iconUrl,
      category,
      desc: cdItem?.desc || '',
      effects,
      composition: compositionIds,
      apiName: cdItem?.apiName || '',
    })
  }
  console.log(`Loaded ${itemMap.size} items`)

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
        variables: toNameValueArray(e.variables),
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
