// Pure helpers for the Bronze for Life page: no React, no DOM.
//
// A trait "counts" when its unit count sits in a counted tier. By default only
// the bronze tier (Riot style 1) counts; optionally silver (3) and gold (5) do
// too. Unique traits (style 4) and prismatic (6) never count. Going past the
// last counted tier stops a trait counting, so each trait is a count range,
// e.g. Coven 3-3 (bronze only) or 3-6 (bronze to gold).

export const BOARD_SIZES = [5, 6, 7, 8, 9, 10]
export const MAX_EMBLEMS = 10
// Legendary units and anything above, for the "no 5-costs" option.
export const LEGENDARY_COST = 5
const BRONZE_STYLES = new Set([1])
const BRONZE_TO_GOLD_STYLES = new Set([1, 3, 5])
// Safety net for the search below; real Set 18 searches finish well under it.
// Hitting it returns the best comps found so far, flagged truncated.
const NODE_CAP = 3_000_000

// Set-specific: units whose traits are chosen in game. Set 18 Kha'Zix evolves
// with takedowns into 3 of these 4 traits (fully evolved). Taking all 4 is
// only considered when the 4th adds a counted trait; such comps rank first
// within their trait count. Update when the set changes.
const TRAIT_CHOICE_UNITS = {
  DA_18_KhaZix: { pick: 3, from: ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'] },
}

// Emblems are named "<Trait> Emblem" and grant +1 to that trait.
export function getEmblemTrait(item) {
  if (!item || !/emblem/i.test(item.name)) return null
  return item.name.replace(/\s*emblem$/i, '').trim()
}

// Where a tier ends: CDragon's maxUnits when present, else one below the next
// tier's minUnits (open-ended for the last tier).
function tierMax(effect, effects) {
  if (effect.maxUnits != null) return effect.maxUnits
  const next = effects.map(e => e.minUnits).filter(min => min > effect.minUnits)
  return next.length > 0 ? Math.min(...next) - 1 : Infinity
}

// A trait's tiers in order as { min, max, style }. When two tiers start at the
// same count the higher style wins: Rival lists a 1-1 bronze row beside 1+
// gold, and in game it is gold at both 1 and 2.
function traitTiers(trait) {
  const byMin = new Map()
  for (const effect of trait?.effects || []) {
    if ((effect.minUnits ?? 0) <= 0) continue
    const current = byMin.get(effect.minUnits)
    if (!current || effect.style > current.style) byMin.set(effect.minUnits, effect)
  }
  const effects = [...byMin.values()].sort((a, b) => a.minUnits - b.minUnits)
  return effects.map(e => ({ min: e.minUnits, max: tierMax(e, effects), style: e.style }))
}

// trait name -> { lo, hi } counted range, for traits that have one: from the
// first counted tier through the counted tiers right after it. Keyed by
// display name because champion.traits holds display names.
export function traitRanges(traits, { includeSilverGold = false } = {}) {
  const styles = includeSilverGold ? BRONZE_TO_GOLD_STYLES : BRONZE_STYLES
  const ranges = new Map()
  for (const trait of traits || []) {
    const tiers = traitTiers(trait)
    const first = tiers.findIndex(tier => styles.has(tier.style))
    if (first === -1) continue
    let last = first
    while (last + 1 < tiers.length && styles.has(tiers[last + 1].style)) last++
    ranges.set(trait.name, { lo: tiers[first].min, hi: tiers[last].max })
  }
  return ranges
}

export const bronzeRanges = traits => traitRanges(traits)

// Riot style of the tier `count` units reach, or null when inactive.
export function activeTraitStyle(trait, count) {
  const tier = traitTiers(trait).find(t => count >= t.min && count <= t.max)
  return tier ? tier.style : null
}

// Emblems the user can add: one per name, only for traits that can count
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

function combinations(list, size) {
  if (size === 0) return [[]]
  return list.flatMap((first, i) => combinations(list.slice(i + 1), size - 1).map(rest => [first, ...rest]))
}

// Replaces each trait-choice unit with one variant per choice, plus the
// all-traits "bonus" variant. Variants share the unit's id and a group
// (formOf), so a comp fields one of them at most.
export function expandTraitChoices(roster) {
  return roster.flatMap(unit => {
    const choice = TRAIT_CHOICE_UNITS[unit.id]
    if (!choice) return [unit]
    const variant = (chosenTraits, bonusEvolution) => ({
      ...unit,
      traits: [...new Set([...(unit.traits || []), ...chosenTraits])],
      chosenTraits,
      bonusEvolution,
      formOf: unit.id,
    })
    return [
      ...combinations(choice.from, choice.pick).map(chosen => variant(chosen, false)),
      variant(choice.from, true),
    ]
  })
}

// Units with identical counted-trait contributions are interchangeable for the
// search, so it picks how many to take from each class instead of which units.
// Classes with more trait weight go first so good comps are found early and
// prune more; the priciest units of a class are the ones shown.
function buildClasses(roster, traitIndex) {
  const classes = new Map()
  for (const unit of roster) {
    const vector = []
    for (const trait of unit.traits || []) {
      const index = traitIndex.get(trait)
      if (index != null) vector.push([index, unit.traitWeights?.[trait] ?? 1])
    }
    vector.sort((a, b) => a[0] - b[0])
    const key = `${unit.formOf || ''}|${unit.bonusEvolution ? 'bonus' : ''}|${vector.join(';')}`
    if (!classes.has(key)) {
      const weight = vector.reduce((sum, [, w]) => sum + w, 0)
      classes.set(key, { vector, weight, group: unit.formOf || null, bonus: Boolean(unit.bonusEvolution), units: [] })
    }
    classes.get(key).units.push(unit)
  }
  const list = [...classes.values()]
  for (const cls of list) {
    cls.units.sort((a, b) => (b.cost || 0) - (a.cost || 0) || a.name.localeCompare(b.name))
    // A group (Lux forms, Kha'Zix choices) fields one unit per board.
    cls.cap = cls.group ? 1 : cls.units.length
  }
  return list.sort((a, b) => b.weight - a.weight)
}

// > 0 when comp a ranks above comp b: more counted traits, then a Kha'Zix 4th
// evolution, then higher total cost.
const compareComps = (a, b) => a.traitCount - b.traitCount || a.bonus - b.bonus || a.cost - b.cost

// Top `limit` comps of `size` units by counted trait count. `requiredIds` must
// be in every comp. Branch and bound over unit classes: a branch is cut when
// its optimistic score (counted traits now + under-count traits the remaining
// picks could still lift into range, then the priciest units still pickable)
// can't beat the worst comp kept.
export function findBronzeComps({ roster, ranges, size, emblemTraits = [], requiredIds = [], limit = 20 }) {
  const names = [...ranges.keys()]
  const traitIndex = new Map(names.map((name, i) => [name, i]))
  const lo = names.map(name => ranges.get(name).lo)
  const hi = names.map(name => ranges.get(name).hi)
  const counts = new Array(names.length).fill(0)
  for (const trait of emblemTraits) {
    const index = traitIndex.get(trait)
    if (index != null) counts[index]++
  }

  // Required units are placed up front, except a trait-choice unit: its
  // variants stay in the search and one of them must be picked.
  const required = new Set(requiredIds)
  const units = expandTraitChoices(roster || [])
  const fixed = units.filter(unit => required.has(unit.id) && !unit.chosenTraits)
  const requiredGroups = [...new Set(units.filter(u => required.has(u.id) && u.chosenTraits).map(u => u.formOf))]
  const fixedGroups = new Set(fixed.map(unit => unit.formOf).filter(Boolean))
  const free = units.filter(unit => !(required.has(unit.id) && !unit.chosenTraits) && !fixedGroups.has(unit.formOf))
  const missing = requiredIds.filter(id => !units.some(unit => unit.id === id))
  const open = size - fixed.length
  if (missing.length > 0 || open < requiredGroups.length) return { comps: [], truncated: false, tooManyRequired: open < requiredGroups.length }

  let cost = 0
  for (const unit of fixed) {
    cost += unit.cost || 0
    for (const trait of unit.traits || []) {
      const index = traitIndex.get(trait)
      if (index != null) counts[index] += unit.traitWeights?.[trait] ?? 1
    }
  }

  const classes = buildClasses(free, traitIndex)
  // From class i on: supply[i][t] = most units of trait t still addable,
  // maxWeight[i] = most trait weight on one unit, topCost[i][r] = total cost
  // of the r priciest units still pickable, bonusLeft[i] = a bonus variant left.
  const supply = [new Array(names.length).fill(0)]
  const maxWeight = [0]
  const bonusLeft = [false]
  let costs = []
  const topCost = [[0]]
  for (let i = classes.length - 1; i >= 0; i--) {
    const cls = classes[i]
    const next = supply[0].slice()
    for (const [t, w] of cls.vector) next[t] += w * cls.cap
    supply.unshift(next)
    maxWeight.unshift(Math.max(maxWeight[0], cls.weight))
    bonusLeft.unshift(bonusLeft[0] || cls.bonus)
    costs = [...costs, ...cls.units.slice(0, cls.cap).map(unit => unit.cost || 0)].sort((a, b) => b - a)
    const prefix = [0]
    for (const c of costs.slice(0, size)) prefix.push(prefix[prefix.length - 1] + c)
    topCost.unshift(prefix)
  }
  const groupLast = new Map()
  classes.forEach((cls, i) => { if (cls.group) groupLast.set(cls.group, i) })

  const inRange = t => counts[t] >= lo[t] && counts[t] <= hi[t]
  const score = () => names.reduce((sum, _, t) => sum + Number(inRange(t)), 0)
  const bound = (i, remaining) => {
    let total = 0
    const deficits = []
    for (let t = 0; t < names.length; t++) {
      if (counts[t] > hi[t]) continue // past the range: counts only grow
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
  const withVector = (vector, sign) => { for (const [t, w] of vector) counts[t] += sign * w }

  const kept = [] // best first
  const picks = new Array(classes.length).fill(0)
  const groupsUsed = new Map()
  let bonusPick = -1
  let nodes = 0
  let truncated = false

  const leaf = () => {
    if (requiredGroups.some(group => !groupsUsed.get(group))) return
    const traitCount = score()
    let bonus = 0
    if (bonusPick !== -1) {
      // Keep the 4th evolution only when it beats every 3-trait choice.
      const group = classes[bonusPick].group
      withVector(classes[bonusPick].vector, -1)
      let bestChoice = -1
      for (const cls of classes) {
        if (cls.group !== group || cls.bonus) continue
        withVector(cls.vector, 1)
        bestChoice = Math.max(bestChoice, score())
        withVector(cls.vector, -1)
      }
      withVector(classes[bonusPick].vector, 1)
      if (traitCount <= bestChoice) return
      bonus = 1
    }
    const candidate = { traitCount, bonus, cost }
    if (kept.length < limit || compareComps(candidate, kept[kept.length - 1]) > 0) {
      kept.push({ ...candidate, picks: picks.slice() })
      kept.sort((a, b) => compareComps(b, a))
      if (kept.length > limit) kept.pop()
    }
  }

  const visit = (i, remaining) => {
    if (++nodes > NODE_CAP) { truncated = true; return }
    if (remaining === 0) { leaf(); return }
    if (i === classes.length) return
    if (requiredGroups.some(group => !groupsUsed.get(group) && groupLast.get(group) < i)) return
    if (kept.length === limit) {
      const worst = kept[kept.length - 1]
      const best = bound(i, remaining)
      if (best < worst.traitCount) return
      if (best === worst.traitCount) {
        const bonus = bonusPick !== -1 || bonusLeft[i] ? 1 : 0
        if (bonus < worst.bonus) return
        const costCap = cost + (topCost[i][remaining] ?? topCost[i][topCost[i].length - 1])
        if (bonus === worst.bonus && costCap <= worst.cost) return
      }
    }

    const cls = classes[i]
    const groupLeft = cls.group ? cls.cap - (groupsUsed.get(cls.group) || 0) : cls.cap
    for (let take = Math.min(remaining, groupLeft); take >= 0 && !truncated; take--) {
      if (take > 0) {
        for (const [t, w] of cls.vector) counts[t] += w * take
        for (const unit of cls.units.slice(0, take)) cost += unit.cost || 0
        if (cls.group) groupsUsed.set(cls.group, (groupsUsed.get(cls.group) || 0) + take)
        if (cls.bonus) bonusPick = i
      }
      picks[i] = take
      visit(i + 1, remaining - take)
      if (take > 0) {
        for (const [t, w] of cls.vector) counts[t] -= w * take
        for (const unit of cls.units.slice(0, take)) cost -= unit.cost || 0
        if (cls.group) groupsUsed.set(cls.group, groupsUsed.get(cls.group) - take)
        if (cls.bonus) bonusPick = -1
      }
      picks[i] = 0
    }
  }
  visit(0, open)

  const comps = kept
    .map(entry => describeComp(entry, classes, fixed, ranges, emblemTraits))
    .sort((a, b) => b.traitCount - a.traitCount
      || Number(b.bonusEvolution) - Number(a.bonusEvolution)
      || b.totalCost - a.totalCost
      || a.key.localeCompare(b.key))
  return { comps, truncated, tooManyRequired: false }
}

const byCostThenName = (a, b) => (a.champion.cost || 0) - (b.champion.cost || 0) || a.champion.name.localeCompare(b.champion.name)

function describeComp({ traitCount, bonus, picks }, classes, fixed, ranges, emblemTraits) {
  const units = fixed.map(champion => ({ champion, alternatives: [], required: true }))
  picks.forEach((take, i) => {
    const members = classes[i].units
    for (const champion of members.slice(0, take)) units.push({ champion, alternatives: members.slice(take), required: false })
  })
  units.sort(byCostThenName)

  const traitCounts = new Map()
  const add = (trait, n) => traitCounts.set(trait, (traitCounts.get(trait) || 0) + n)
  for (const { champion } of units) {
    for (const trait of champion.traits || []) add(trait, champion.traitWeights?.[trait] ?? 1)
  }
  for (const trait of emblemTraits) add(trait, 1)

  const counted = trait => {
    const range = ranges.get(trait)
    const count = traitCounts.get(trait) || 0
    return Boolean(range) && count >= range.lo && count <= range.hi
  }
  const countedTraits = []
  const otherTraits = []
  for (const [name, count] of traitCounts) (counted(name) ? countedTraits : otherTraits).push({ name, count })
  const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  return {
    key: units.map(({ champion }) => [champion.id, ...(champion.chosenTraits || [])].join('+')).join('|'),
    traitCount,
    bonusEvolution: bonus === 1,
    totalCost: units.reduce((sum, { champion }) => sum + (champion.cost || 0), 0),
    units,
    countedTraits: countedTraits.sort(byCount),
    otherTraits: otherTraits.sort(byCount),
    // Emblems that put their trait in a counted tier, i.e. the ones in use.
    usedEmblemTraits: emblemTraits.filter(counted),
  }
}
