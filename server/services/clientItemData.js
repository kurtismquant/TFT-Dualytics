import { readFileSync } from 'node:fs'
import { CURRENT_SET } from '../constants/game.js'

// Item tooltips extracted from the local TFT (Unreal) client by
// scripts/tft_client/extract.py. CommunityDragon has no descriptions for the
// Set 18 DA_ items, so the client's own tooltip text is used. Per item:
//   { stats: '<TFTCurveTable row="AttackDamage" icon="Icon.AD" type="stat" format="percent"/> …',
//     desc: 'Gain <Keyword>Precision</>. …',
//     rows: { AttackDamage: 0.35, … },     // curve-table values the tags reference
//     tokens: { GenericCalc1: 4 } }        // evaluated item calculations
export const loadClientItemData = (setNumber = CURRENT_SET) => {
  try {
    const url = new URL(`../data/itemData.set${setNumber}.json`, import.meta.url)
    return JSON.parse(readFileSync(url, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Client item data for set ${setNumber} unreadable:`, err.message)
    return {}
  }
}

// Unreal rich-text tags that carry a value or an icon:
//   <TFTCurveTable row="AD%" format="percent" icon="Icon.AD" type="stat"/>
//   <TFTAttribute attributeID="TFTCalculationAttributes.GenericCalc1" fallbackRow="Default_CritBonus"/>
//   <img id="icon.Coin"/>
// Other tags (<Keyword>, <Rules>, <colorRadiant>, </>) are left for the
// client tokenizer, which strips markup from text.
const VALUE_TAG_RE = /<(TFTCurveTable|TFTAttribute|img)\b([^>]*?)\/>/gi
// In descriptions, also take a literal "%" written right after a value tag so
// the stat icon goes after it ("30% [icon]", not "30 [icon]%").
const DESC_TAG_RE = /<(TFTCurveTable|TFTAttribute|img)\b([^>]*?)\/>(%?)/gi
const parseAttrs = (s) => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k.toLowerCase(), v]))
const iconKey = (icon) => String(icon || '').toLowerCase().replace(/^icon\./, '')

// Stat names ItemCard's stat list knows, by the tag's icon.
const STAT_BY_ICON = {
  ad: 'AttackDamage', ap: 'AbilityPower', as: 'AttackSpeed', armor: 'Armor', mr: 'MagicResist',
  health: 'Health', manaregen: 'ManaRegen', critchance: 'CritChance', critdmg: 'CritDamage',
  damageamp: 'DamageAmp', omnivamp: 'Omnivamp', dura: 'Durability',
}
// %i:scale<X>% references the description tokenizer renders as stat icons.
const SCALE_BY_ICON = {
  ad: 'AD', ap: 'AP', as: 'AS', armor: 'Armor', mr: 'MR', health: 'Health', manaregen: 'ManaRegen',
  critchance: 'CritChance', critdmg: 'CritDmg', damageamp: 'DA', omnivamp: 'Omnivamp', dura: 'DR',
}

const clean = (n) => Math.round(n * 1e6) / 1e6
const lookup = (map, name) => {
  if (!map || !name) return undefined
  const key = Object.keys(map).find(k => k.toLowerCase() === name.toLowerCase())
  return key === undefined ? undefined : map[key]
}

// The tag's format attribute → the shown value and whether it's a percentage.
// Without one the number is shown as-is (a 0.8s stun is not "80%").
const applyFormat = (v, format) => {
  switch (String(format || '').toLowerCase()) {
    case 'percent':
    case 'p':
      return { value: v, percent: true }
    case 'percentminusone':
      return { value: clean(v - 1), percent: true } // attack speed multiplier 1.1 → 10%
    case 'invertedpercent':
      return { value: clean(1 - v), percent: true } // incoming damage 0.9 → 10% reduction
    default:
      return { value: v, percent: false }
  }
}

// A tag's value, or undefined when it only exists in a live game (stack
// counters, stage-scaled damage from custom calculations).
const tagValue = (kind, attrs, entry) => {
  if (kind === 'tftcurvetable') return lookup(entry.rows, attrs.row)
  // attributeID="TFTCalculationAttributes.GenericCalc1": an evaluated calculation.
  // Shop tooltips show fallbackRow while there's no holder to compute it for.
  const name = (attrs.attributeid || '').split('.').pop()
  const value = lookup(entry.tokens, name)
  return value ?? (attrs.fallbackrow ? lookup(entry.rows, attrs.fallbackrow) : undefined)
}

const toPart = ({ value, percent }) =>
  percent ? { values: [0, value, value, value], percent: true } : { values: [0, value, value, value], plain: true }

// Client item entry → what ItemCard renders:
//   effects:      stat line as [{ name, value, percent? }]
//   desc:         description in the tokenizer's @Token@ / %i:scaleX% markup
//   calculations: the description's token values, [{ values: [_, v, v, v], percent? | plain? }]
export const buildClientItem = (entry) => {
  if (!entry) return null

  const effects = []
  for (const [, kind, raw] of (entry.stats || '').matchAll(VALUE_TAG_RE)) {
    const attrs = parseAttrs(raw)
    const name = STAT_BY_ICON[iconKey(attrs.icon)]
    const v = tagValue(kind.toLowerCase(), attrs, entry)
    if (!name || typeof v !== 'number') continue
    const { value, percent } = applyFormat(v, attrs.format)
    effects.push(percent ? { name, value, percent: true } : { name, value })
  }

  const calculations = {}
  let next = 0
  const lines = (entry.desc || '').split(/\r?\n/).map((line) => {
    let unknown = false
    const text = line
      .replace(/\{[\w.]+\}/g, '') // FText arguments the game fills in (augment variants, stack counts)
      .replace(DESC_TAG_RE, (tag, kind, raw, pct) => {
        const attrs = parseAttrs(raw)
        const k = kind.toLowerCase()
        const scale = SCALE_BY_ICON[iconKey(k === 'img' ? attrs.id : attrs.icon)]
        const icon = scale ? `%i:scale${scale}%` : ''
        if (k === 'img') return icon + pct
        const v = tagValue(k, attrs, entry)
        if (typeof v !== 'number') {
          unknown = true
          return ''
        }
        const token = `ItemValue${next++}`
        calculations[token] = [toPart(applyFormat(v, attrs.format))]
        return icon ? `@${token}@${pct} ${icon}` : `@${token}@${pct}`
      })
    // A readout of live state ("Gold generated this game: <stack>") has
    // nothing to show outside a game — drop the line.
    return unknown && /:\s*(<[^>]*>\s*)*$/.test(text) ? null : text
  })
  const desc = lines.filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return { desc, effects, calculations }
}
