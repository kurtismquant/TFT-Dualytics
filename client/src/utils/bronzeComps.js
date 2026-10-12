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
// A comp gets the "highly played" star when at least this many boards on the
// current patch fielded exactly its units (server board index).
export const HIGHLY_PLAYED_MIN_BOARDS = 5
const BRONZE_STYLES = new Set([1])
const BRONZE_TO_GOLD_STYLES = new Set([1, 3, 5])
// Safety net for the search below; real Set 18 searches (100 comps of 10 units)
// finish well under it. Hitting it returns the best comps found so far,
// flagged truncated.
const NODE_CAP = 10_000_000

// Set-specific: units whose traits are chosen in game. Set 18 Kha'Zix evolves
// with takedowns into 3 of these 4 traits (fully evolved). Taking all 4 is
// only considered when the 4th adds a counted trait; since a 4th evolution is
// rare, such comps rank last within their trait count. Update when the set changes.
const TRAIT_CHOICE_UNITS = {
  DA_18_KhaZix: { pick: 3, from: ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'] },
}
// For the "No Kha'Zix" option.
export const TRAIT_CHOICE_UNIT_IDS = new Set(Object.keys(TRAIT_CHOICE_UNITS))

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

// > 0 when comp a ranks above comp b: more counted traits, then no Kha'Zix
// 4th evolution, then higher total cost.
const compareComps = (a, b) => a.traitCount - b.traitCount || b.bonus - a.bonus || a.cost - b.cost

// Top `limit` comps of `size` units by counted trait count. `requiredIds` must
// be in every comp. Branch and bound over unit classes: a branch is cut when
// its optimistic score (counted traits now + under-count traits the remaining
// picks could still lift into range, then the priciest units still pickable)
// can't beat the worst comp kept.
export function findBronzeComps({ roster, ranges, size, emblemTraits = [], requiredIds = [], limit = 20, nodeCap = NODE_CAP }) {
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
  // From class i on: supply[i][t] = most units of trait t still addable;
  // topWeight[i][r] / topCost[i][r] = most trait weight / total cost r units
  // can still bring. A group (Lux forms, Kha'Zix choices) fields one unit, so
  // it enters those lists once, with its best weight and cost; counting each
  // form separately made the bounds too loose to prune.
  const supply = [new Array(names.length).fill(0)]
  const topWeight = [[0]]
  const topCost = [[0]]
  const plainWeights = []
  const plainCosts = []
  const groupBest = new Map()
  const prefixSums = values => {
    const sums = [0]
    for (const v of values.sort((a, b) => b - a).slice(0, size)) sums.push(sums[sums.length - 1] + v)
    return sums
  }
  for (let i = classes.length - 1; i >= 0; i--) {
    const cls = classes[i]
    const next = supply[0].slice()
    for (const [t, w] of cls.vector) next[t] += w * cls.cap
    supply.unshift(next)
    if (cls.group) {
      const best = groupBest.get(cls.group) || { weight: 0, cost: 0 }
      groupBest.set(cls.group, { weight: Math.max(best.weight, cls.weight), cost: Math.max(best.cost, cls.units[0].cost || 0) })
    } else {
      for (const unit of cls.units) {
        plainWeights.push(cls.weight)
        plainCosts.push(unit.cost || 0)
      }
    }
    const groups = [...groupBest.values()]
    topWeight.unshift(prefixSums([...plainWeights, ...groups.map(g => g.weight)]))
    topCost.unshift(prefixSums([...plainCosts, ...groups.map(g => g.cost)]))
  }
  const topSum = (sums, r) => sums[Math.min(r, sums.length - 1)]
  const groupLast = new Map()
  classes.forEach((cls, i) => { if (cls.group) groupLast.set(cls.group, i) })

  const traitTotal = names.length
  const score = () => {
    let total = 0
    for (let t = 0; t < traitTotal; t++) if (counts[t] >= lo[t] && counts[t] <= hi[t]) total++
    return total
  }
  // Deficits are small (a trait needs at most a few more units), so they are
  // tallied by size instead of sorted; this runs at every search node.
  const maxDeficit = Math.max(1, ...lo)
  const deficitsBySize = new Array(maxDeficit + 1).fill(0)
  const bound = (i, remaining) => {
    let total = 0
    deficitsBySize.fill(0)
    const traitSupply = supply[i]
    for (let t = 0; t < traitTotal; t++) {
      const count = counts[t]
      if (count > hi[t]) continue // past the range: counts only grow
      if (count >= lo[t]) total++
      else if (traitSupply[t] >= lo[t] - count) deficitsBySize[lo[t] - count]++
    }
    let budget = topSum(topWeight[i], remaining)
    for (let size = 1; size <= maxDeficit && budget >= size; size++) {
      const filled = Math.min(deficitsBySize[size], Math.floor(budget / size))
      total += filled
      budget -= filled * size
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

  // A board reached twice (see the 4th-evolution swap below) is kept once.
  const keptKeys = new Set()
  const keep = (candidate, candidatePicks) => {
    if (kept.length === limit && compareComps(candidate, kept[kept.length - 1]) <= 0) return
    const key = candidatePicks.join(',')
    if (keptKeys.has(key)) return
    let at = kept.length
    while (at > 0 && compareComps(candidate, kept[at - 1]) > 0) at--
    kept.splice(at, 0, { ...candidate, picks: candidatePicks })
    keptKeys.add(key)
    if (kept.length > limit) keptKeys.delete(kept.pop().picks.join(','))
  }

  const leaf = () => {
    if (requiredGroups.some(group => !groupsUsed.get(group))) return
    const traitCount = score()
    if (bonusPick === -1) {
      keep({ traitCount, bonus: 0, cost }, picks.slice())
      return
    }
    // The 4th evolution only counts when it beats every 3-trait choice. When it
    // doesn't, keep the best 3-trait board instead of dropping the leaf: the
    // bonus variant has the most weight, so its branch is searched first, and
    // dropping every leaf there (e.g. with an Executioner emblem) left nothing
    // to prune against, so the node budget ran out with no comps at 9+ units.
    const group = classes[bonusPick].group
    withVector(classes[bonusPick].vector, -1)
    let bestChoice = -1
    let bestIndex = -1
    classes.forEach((cls, index) => {
      if (cls.group !== group || cls.bonus) return
      withVector(cls.vector, 1)
      const choiceCount = score()
      if (choiceCount > bestChoice) { bestChoice = choiceCount; bestIndex = index }
      withVector(cls.vector, -1)
    })
    withVector(classes[bonusPick].vector, 1)
    if (traitCount > bestChoice) {
      keep({ traitCount, bonus: 1, cost }, picks.slice())
    } else if (bestIndex !== -1) {
      const choicePicks = picks.slice()
      choicePicks[bonusPick] = 0
      choicePicks[bestIndex] = 1
      keep({ traitCount: bestChoice, bonus: 0, cost: cost - (classes[bonusPick].units[0].cost || 0) + (classes[bestIndex].units[0].cost || 0) }, choicePicks)
    }
  }

  const visit = (i, remaining) => {
    if (++nodes > nodeCap) { truncated = true; return }
    if (remaining === 0) { leaf(); return }
    if (i === classes.length) return
    if (requiredGroups.some(group => !groupsUsed.get(group) && groupLast.get(group) < i)) return
    if (kept.length === limit) {
      const worst = kept[kept.length - 1]
      const best = bound(i, remaining)
      if (best < worst.traitCount) return
      if (best === worst.traitCount) {
        // Best case on the 4th-evolution key: none, unless one is already picked.
        const bonus = bonusPick !== -1 ? 1 : 0
        if (bonus > worst.bonus) return
        const costCap = cost + topSum(topCost[i], remaining)
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
      || Number(a.bonusEvolution) - Number(b.bonusEvolution)
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
  const nearTraits = []
  for (const [name, count] of traitCounts) {
    ;(counted(name) ? countedTraits : otherTraits).push({ name, count })
    // One unit or emblem short of counting: worth playing for an emblem.
    const range = ranges.get(name)
    if (range && count === range.lo - 1) nearTraits.push({ name, count, needed: range.lo })
  }
  const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  return {
    key: units.map(({ champion }) => [champion.id, ...(champion.chosenTraits || [])].join('+')).join('|'),
    traitCount,
    bonusEvolution: bonus === 1,
    totalCost: units.reduce((sum, { champion }) => sum + (champion.cost || 0), 0),
    units,
    countedTraits: countedTraits.sort(byCount),
    otherTraits: otherTraits.sort(byCount),
    nearTraits: nearTraits.sort(byCount),
    // Emblems that put their trait in a counted tier, i.e. the ones in use.
    usedEmblemTraits: emblemTraits.filter(counted),
  }
}

// The comps in the `tiers` highest trait counts (e.g. every 11- and 10-trait
// comp, none with 9): the recommended units widget's pool.
export function compsInTopTraitCounts(comps, tiers = 2) {
  const traitCounts = [...new Set((comps || []).map(comp => comp.traitCount))].sort((a, b) => b - a).slice(0, tiers)
  return { traitCounts, comps: (comps || []).filter(comp => traitCounts.includes(comp.traitCount)) }
}

// Units appearing in the most of the first `top` comps (all by default; each
// comp counts a unit once): ties go to the cheaper unit, and units still tied
// with the last pick (same count and cost) are all included, so this can
// return more than `count`. [{ champion, appearances }]
export function recommendUnits(comps, { top = Infinity, count = 3 } = {}) {
  const tally = new Map()
  for (const comp of (comps || []).slice(0, top)) {
    for (const { champion } of comp.units) {
      const row = tally.get(champion.id) || { champion, appearances: 0 }
      row.appearances++
      tally.set(champion.id, row)
    }
  }
  const cost = row => row.champion.cost || 0
  const rows = [...tally.values()].sort((a, b) => b.appearances - a.appearances
    || cost(a) - cost(b)
    || a.champion.name.localeCompare(b.champion.name))
  if (rows.length <= count) return rows
  const last = rows[count - 1]
  return rows.filter((row, i) => i < count || (row.appearances === last.appearances && cost(row) === cost(last)))
}

// Comps sorted by trait count -> consecutive runs [{ traitCount, comps }], one
// heading each on the page.
export function groupByTraitCount(comps) {
  const groups = []
  for (const comp of comps) {
    const last = groups[groups.length - 1]
    if (last && last.traitCount === comp.traitCount) last.comps.push(comp)
    else groups.push({ traitCount: comp.traitCount, comps: [comp] })
  }
  return groups
}
