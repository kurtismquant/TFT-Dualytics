// Pure helpers for the Bronze for Life page: no React, no DOM.
//
// A trait is "bronze" when its unit count sits inside its lowest tier and that
// tier is styled bronze (Riot style 1). Going over moves it to silver, so each
// bronze trait is a count range, e.g. Coven 3-3, Elderwood 3-4. Unique traits
// (single style-4 tier) and traits whose first tier isn't bronze never count.

export const BOARD_SIZES = [5, 6, 7, 8, 9, 10]
export const MAX_EMBLEMS = 10
const BRONZE_STYLE = 1
// Safety net for the search below; real Set 18 searches finish in well under
// 1M nodes. Hitting it returns the best comps found so far, flagged truncated.
const NODE_CAP = 3_000_000

// Emblems are named "<Trait> Emblem" and grant +1 to that trait.
export function getEmblemTrait(item) {
  if (!item || !/emblem/i.test(item.name)) return null
  return item.name.replace(/\s*emblem$/i, '').trim()
}

const activeEffects = trait => (trait?.effects || []).filter(e => (e.minUnits ?? 0) > 0)

// Where a tier ends: CDragon's maxUnits when present, else one below the next
// tier's minUnits (open-ended for the last tier).
function tierMax(effect, effects) {
  if (effect.maxUnits != null) return effect.maxUnits
  const next = effects.map(e => e.minUnits).filter(min => min > effect.minUnits)
  return next.length > 0 ? Math.min(...next) - 1 : Infinity
}

// trait name -> { lo, hi } bronze count range, for traits that have one.
// Keyed by display name because champion.traits holds display names.
export function bronzeRanges(traits) {
  const ranges = new Map()
  for (const trait of traits || []) {
    const effects = activeEffects(trait)
    const bronze = effects.filter(e => e.style === BRONZE_STYLE)
    if (bronze.length === 0) continue
    ranges.set(trait.name, {
      lo: Math.min(...bronze.map(e => e.minUnits)),
      hi: Math.max(...bronze.map(e => tierMax(e, effects))),
    })
  }
  return ranges
}

// Riot style of the tier `count` units reach, or null when inactive. Some
// traits list overlapping tiers (Rival: 1+ gold and 1-1 bronze); the
// narrowest tier containing the count is the one the game shows.
export function activeTraitStyle(trait, count) {
  const effects = activeEffects(trait)
  let best = null
  for (const effect of effects) {
    const max = tierMax(effect, effects)
    if (count < effect.minUnits || count > max) continue
    if (!best || max - effect.minUnits < best.width) best = { style: effect.style, width: max - effect.minUnits }
  }
  return best ? best.style : null
}

// Emblems the user can add: one per name, only for traits with a bronze tier
// (Phantom Emblem and the like map to no trait).
export function buildEmblemOptions(items, ranges) {
  const byName = new Map()
  for (const item of items || []) {
    if (item?.category !== 'emblem' || byName.has(item.name)) continue
    const trait = getEmblemTrait(item)
    if (trait && ranges.has(trait)) byName.set(item.name, { id: String(item.id), name: item.name, trait })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// Units with identical bronze-trait contributions are interchangeable for the
// search, so it picks how many to take from each class instead of which units.
// Classes with more trait weight go first so good comps are found early and
// prune more; the cheapest units of a class are the ones shown.
function buildClasses(roster, traitIndex) {
  const classes = new Map()
  for (const unit of roster) {
    const vector = []
    for (const trait of unit.traits || []) {
      const index = traitIndex.get(trait)
      if (index != null) vector.push([index, unit.traitWeights?.[trait] ?? 1])
    }
    vector.sort((a, b) => a[0] - b[0])
    const key = `${unit.formOf || ''}|${vector.join(';')}`
    if (!classes.has(key)) {
      const weight = vector.reduce((sum, [, w]) => sum + w, 0)
      classes.set(key, { vector, weight, group: unit.formOf || null, units: [] })
    }
    classes.get(key).units.push(unit)
  }
  const list = [...classes.values()]
  for (const cls of list) {
    cls.units.sort((a, b) => (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name))
    // A form group (Lux) fields one unit per board, whichever form.
    cls.cap = cls.group ? 1 : cls.units.length
  }
  return list.sort((a, b) => b.weight - a.weight)
}

// Top `limit` comps of `size` units by bronze trait count (ties: cheaper
// first). Branch and bound over unit classes: a branch is cut when even its
// optimistic score (bronze now + under-count traits the remaining picks could
// still lift into range) can't beat the worst comp kept.
export function findBronzeComps({ roster, ranges, size, emblemTraits = [], limit = 20 }) {
  const names = [...ranges.keys()]
  const traitIndex = new Map(names.map((name, i) => [name, i]))
  const lo = names.map(name => ranges.get(name).lo)
  const hi = names.map(name => ranges.get(name).hi)
  const counts = new Array(names.length).fill(0)
  for (const trait of emblemTraits) {
    const index = traitIndex.get(trait)
    if (index != null) counts[index]++
  }

  const classes = buildClasses(roster || [], traitIndex)
  // supply[i][t]: most units of trait t the classes from i on can still add.
  // maxWeight[i]: most trait weight one unit from those classes carries.
  const supply = [new Array(names.length).fill(0)]
  const maxWeight = [0]
  for (let i = classes.length - 1; i >= 0; i--) {
    const next = supply[0].slice()
    for (const [t, w] of classes[i].vector) next[t] += w * classes[i].cap
    supply.unshift(next)
    maxWeight.unshift(Math.max(maxWeight[0], classes[i].weight))
  }

  const isBronze = t => counts[t] >= lo[t] && counts[t] <= hi[t]
  const score = () => names.reduce((sum, _, t) => sum + Number(isBronze(t)), 0)
  const bound = (i, remaining) => {
    let total = 0
    const deficits = []
    for (let t = 0; t < names.length; t++) {
      if (counts[t] > hi[t]) continue // over the range: counts only grow
      if (counts[t] >= lo[t]) total++
      else if (supply[i][t] >= lo[t] - counts[t]) deficits.push(lo[t] - counts[t])
    }
    deficits.sort((a, b) => a - b)
    let budget = remaining * maxWeight[i]
    for (const deficit of deficits) {
      if (deficit > budget) break
      budget -= deficit
      total++
    }
    return total
  }

  const kept = [] // { bronzeCount, picks }, best first
  const picks = new Array(classes.length).fill(0)
  const groupsUsed = new Map()
  let nodes = 0
  let truncated = false

  const visit = (i, remaining) => {
    if (++nodes > NODE_CAP) { truncated = true; return }
    if (remaining === 0) {
      const bronzeCount = score()
      if (kept.length < limit || bronzeCount > kept[kept.length - 1].bronzeCount) {
        kept.push({ bronzeCount, picks: picks.slice() })
        kept.sort((a, b) => b.bronzeCount - a.bronzeCount)
        if (kept.length > limit) kept.pop()
      }
      return
    }
    if (i === classes.length) return
    if (kept.length === limit && bound(i, remaining) <= kept[kept.length - 1].bronzeCount) return

    const cls = classes[i]
    const groupLeft = cls.group ? cls.cap - (groupsUsed.get(cls.group) || 0) : cls.cap
    for (let take = Math.min(remaining, groupLeft); take >= 0 && !truncated; take--) {
      for (const [t, w] of cls.vector) counts[t] += w * take
      if (cls.group) groupsUsed.set(cls.group, (groupsUsed.get(cls.group) || 0) + take)
      picks[i] = take
      visit(i + 1, remaining - take)
      for (const [t, w] of cls.vector) counts[t] -= w * take
      if (cls.group) groupsUsed.set(cls.group, groupsUsed.get(cls.group) - take)
      picks[i] = 0
    }
  }
  visit(0, size)

  const comps = kept
    .map(entry => describeComp(entry, classes, ranges, emblemTraits))
    .sort((a, b) => b.bronzeCount - a.bronzeCount || a.totalCost - b.totalCost)
  return { comps, truncated }
}

function describeComp({ bronzeCount, picks }, classes, ranges, emblemTraits) {
  const units = []
  picks.forEach((take, i) => {
    const members = classes[i].units
    for (const champion of members.slice(0, take)) units.push({ champion, alternatives: members.slice(take) })
  })
  units.sort((a, b) => (a.champion.cost || 0) - (b.champion.cost || 0) || a.champion.name.localeCompare(b.champion.name))

  const traitCounts = new Map()
  const add = (trait, n) => traitCounts.set(trait, (traitCounts.get(trait) || 0) + n)
  for (const { champion } of units) {
    for (const trait of champion.traits || []) add(trait, champion.traitWeights?.[trait] ?? 1)
  }
  for (const trait of emblemTraits) add(trait, 1)

  const bronzeTraits = []
  const otherTraits = []
  for (const [name, count] of traitCounts) {
    const range = ranges.get(name)
    const inRange = range && count >= range.lo && count <= range.hi
    ;(inRange ? bronzeTraits : otherTraits).push({ name, count })
  }
  const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  return {
    bronzeCount,
    totalCost: units.reduce((sum, { champion }) => sum + (champion.cost || 0), 0),
    units,
    bronzeTraits: bronzeTraits.sort(byCount),
    otherTraits: otherTraits.sort(byCount),
  }
}
