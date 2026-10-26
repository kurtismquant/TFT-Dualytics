// Pure helpers for the Bronze for Life page: no React, no DOM.
//
// A trait "counts" when its unit count sits in a counted tier. By default only
// the bronze tier (Riot style 1) counts; optionally silver (3) and gold (5) do
// too. Unique traits (style 4) and prismatic (6) never count. Going past the
// last counted tier stops a trait counting, so each trait is a count range,
// e.g. Coven 3-3 (bronze only) or 3-6 (bronze to gold).

export const BOARD_SIZES = [5, 6, 7, 8, 9, 10, 11, 12]
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
export const TRAIT_CHOICE_UNITS = {
  DA_18_KhaZix: { pick: 3, from: ['Executioner', 'Rapidfire', 'Ravager', 'Spellweaver'] },
}
// For the "No Kha'Zix" option.
export const TRAIT_CHOICE_UNIT_IDS = new Set(Object.keys(TRAIT_CHOICE_UNITS))
// How many traits a trait-choice unit can pick from (Kha'Zix: 4); 0 otherwise.
export const traitChoiceCount = unitId => TRAIT_CHOICE_UNITS[unitId]?.from.length ?? 0

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

// Set-specific: the components emblems are crafted from (Set 18: a Spatula
// makes Blossom/Elderwood/Fae/... emblems, a Frying Pan makes Brawler/Hunter/
// Ravager/...). Coven, Defender, Flora Fatalis and Juggernaut emblems have no
// recipe. Read from each emblem's `composition` (component item ids).
export const CRAFT_COMPONENT_IDS = { spatula: 'DA_Component_Spatula', pan: 'DA_Component_FryingPan' }

const craftedFrom = item => {
  const composition = item?.composition || []
  return Object.keys(CRAFT_COMPONENT_IDS).find(tool => composition.includes(CRAFT_COMPONENT_IDS[tool])) || null
}

// Emblems the user can add: one per name, only for traits that can count
// (Phantom Emblem and the like map to no trait). `craftedFrom` names the tool
// that makes it ('spatula' | 'pan'), or null.
export function buildEmblemOptions(items, ranges) {
  const byName = new Map()
  for (const item of items || []) {
    if (item?.category !== 'emblem' || byName.has(item.name)) continue
    const trait = getEmblemTrait(item)
    if (trait && ranges.has(trait)) byName.set(item.name, { id: String(item.id), name: item.name, trait, craftedFrom: craftedFrom(item) })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// { spatula: [trait, ...], pan: [trait, ...] }: what each tool can make.
export function craftableTraits(emblemOptions) {
  const byTool = Object.fromEntries(Object.keys(CRAFT_COMPONENT_IDS).map(tool => [tool, []]))
  for (const option of emblemOptions || []) if (option.craftedFrom) byTool[option.craftedFrom].push(option.trait)
  return byTool
}

// The search's craftTools for the tools the user holds (one of each).
export function craftToolsFor({ hasSpatula, hasFryingPan }, emblemOptions) {
  const byTool = craftableTraits(emblemOptions)
  return [
    ...(hasSpatula ? [{ tool: 'spatula', traits: byTool.spatula }] : []),
    ...(hasFryingPan ? [{ tool: 'pan', traits: byTool.pan }] : []),
  ]
}

function combinations(list, size) {
  if (size === 0) return [[]]
  return list.flatMap((first, i) => combinations(list.slice(i + 1), size - 1).map(rest => [first, ...rest]))
}

// Replaces each trait-choice unit with one variant per choice, plus the
// all-traits "bonus" variant. With `traitCount` (the page's evolutions
// setting) every variant takes exactly that many of the traits instead, and
// there is no bonus variant. Variants share the unit's id and a group
// (formOf), so a comp fields one of them at most.
export function expandTraitChoices(roster, traitCount = null) {
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
    if (traitCount != null) {
      const n = Math.min(Math.max(1, traitCount), choice.from.length)
      return combinations(choice.from, n).map(chosen => variant(chosen, false))
    }
    return [
      ...combinations(choice.from, choice.pick).map(chosen => variant(chosen, false)),
      variant(choice.from, true),
    ]
  })
}

// Build-from-my-units mode: the units picked are the player's current board.
// A board scores
//   trait x its counted traits
//   + sharedTrait x the player's units' traits still counted on it
//   - missing[cost] for each unit the player would still have to buy
// (owned units and selling are free), so boards that keep the player's
// traits rank above ones that only reuse their units. Far-off boards score
// too low to be kept, and BOARD_MAX_SWAPS caps how far a board may go: the
// empty slots plus that many replaced units (it also keeps the search fast;
// 2+ swaps at 10 units can exceed the node budget). Weights are still being
// tuned with the user.
export const BOARD_MAX_SWAPS = 1
export const BOARD_WEIGHTS = {
  trait: 2,
  sharedTrait: 2,
  missing: { 1: 0.5, 2: 0.25, 3: 0.25, 4: 1, 5: 1.5 },
}
const missingPenaltyFor = missing => unit => missing[unit.cost] ?? missing[5] ?? 0

// Units with identical counted-trait contributions are interchangeable for the
// search, so it picks how many to take from each class instead of which units.
// Classes with more trait weight go first so good comps are found early and
// prune more; the priciest units of a class are the ones shown. With `owned`
// (my-board mode) owned units form their own classes, and elsewhere the
// cheapest unit to buy is shown first; penaltyPrefix[k] is the penalty of
// taking k units from a class.
function buildClasses(roster, traitIndex, owned = null, missingPenalty = () => 0) {
  const classes = new Map()
  for (const unit of roster) {
    const vector = []
    for (const trait of unit.traits || []) {
      const index = traitIndex.get(trait)
      if (index != null) vector.push([index, unit.traitWeights?.[trait] ?? 1])
    }
    vector.sort((a, b) => a[0] - b[0])
    const isOwned = Boolean(owned?.has(unit.id))
    const key = `${isOwned ? 'own' : ''}|${unit.formOf || ''}|${unit.bonusEvolution ? 'bonus' : ''}|${vector.join(';')}`
    if (!classes.has(key)) {
      const weight = vector.reduce((sum, [, w]) => sum + w, 0)
      classes.set(key, { vector, weight, group: unit.formOf || null, bonus: Boolean(unit.bonusEvolution), owned: isOwned, units: [] })
    }
    classes.get(key).units.push(unit)
  }
  const list = [...classes.values()]
  for (const cls of list) {
    const penalty = unit => (owned && !cls.owned ? missingPenalty(unit) : 0)
    cls.units.sort((a, b) => penalty(a) - penalty(b) || (b.cost || 0) - (a.cost || 0) || a.name.localeCompare(b.name))
    // A group (Lux forms, Kha'Zix choices) fields one unit per board.
    cls.cap = cls.group ? 1 : cls.units.length
    cls.penaltyPrefix = [0]
    for (const unit of cls.units) cls.penaltyPrefix.push(cls.penaltyPrefix[cls.penaltyPrefix.length - 1] + penalty(unit))
  }
  // My-board mode searches the player's units first: boards keeping them are
  // found early and prune more.
  return list.sort((a, b) => (owned ? Number(b.owned) - Number(a.owned) : 0) || b.weight - a.weight)
}

// > 0 when comp a ranks above comp b: more counted traits, then no Kha'Zix
// 4th evolution, then higher total cost. In my-board mode: higher score, then
// more traits, then less to buy.
const compareComps = (a, b) => a.traitCount - b.traitCount || b.bonus - a.bonus || a.cost - b.cost
const compareBoardComps = (a, b) => a.score - b.score || a.traitCount - b.traitCount || b.penalty - a.penalty
  || b.bonus - a.bonus || a.cost - b.cost

// Top `limit` comps of `size` units by counted trait count. `requiredIds` must
// be in every comp. `craftTools` ([{ tool, traits }], one per Spatula / Frying
// Pan held) may each add +1 to one trait it can make: every board takes its
// best crafting (or none, if it doesn't help), reported as craftedEmblems.
// Branch and bound over unit classes: a branch is cut when its optimistic
// score (counted traits now + under-count traits the remaining picks and tools
// could still lift into range, then the priciest units still pickable) can't
// beat the worst comp kept. With `ownedIds` (my-board mode) comps are ranked
// by score (see BOARD_WEIGHTS; `boardWeights` overrides it) and say what to
// buy and sell; requiredIds are ignored then.
export function findBronzeComps({
  roster, ranges, size, emblemTraits = [], requiredIds = [], craftTools = [], ownedIds = [], choiceTraitCount = null,
  boardWeights = {}, maxSwaps = null, limit = 20, nodeCap = NODE_CAP,
}) {
  const owned = new Set(ownedIds)
  const boardMode = owned.size > 0
  const weights = { ...BOARD_WEIGHTS, ...boardWeights, missing: { ...BOARD_WEIGHTS.missing, ...boardWeights.missing } }
  if (boardMode) requiredIds = []
  const compare = boardMode ? compareBoardComps : compareComps
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
  const units = expandTraitChoices(roster || [], choiceTraitCount)
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

  const classes = buildClasses(free, traitIndex, boardMode ? owned : null, missingPenaltyFor(weights.missing))
  // The player's units' counted traits (my-board mode): kept on a board, they
  // earn weights.sharedTrait each.
  const ownedTraits = boardMode
    ? [...new Set((roster || []).filter(unit => owned.has(unit.id))
      .flatMap(unit => (unit.traits || []).map(trait => traitIndex.get(trait)).filter(index => index != null)))]
    : []
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
  // lowPenalty[i][r]: the least penalty r more picks from class i on can add
  // (my-board mode; a group counts once, with its cheapest unit).
  const lowPenalty = [[0]]
  const plainPenalties = []
  const groupLowPenalty = new Map()
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
    if (boardMode) {
      if (cls.group) groupLowPenalty.set(cls.group, Math.min(groupLowPenalty.get(cls.group) ?? Infinity, cls.penaltyPrefix[1]))
      else for (let k = 1; k < cls.penaltyPrefix.length; k++) plainPenalties.push(cls.penaltyPrefix[k] - cls.penaltyPrefix[k - 1])
      const low = [...plainPenalties, ...groupLowPenalty.values()].sort((a, b) => a - b).slice(0, size)
      const sums = [0]
      for (const v of low) sums.push(sums[sums.length - 1] + v)
      lowPenalty.unshift(sums)
    }
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

  // Tools: trait indices each can make, and per trait how many tools can.
  const tools = craftTools.map(({ tool, traits }) => ({
    tool,
    traits: [...new Set(traits.map(trait => traitIndex.get(trait)).filter(index => index != null))],
  }))
  const toolSupply = new Array(traitTotal).fill(0)
  for (const { traits } of tools) for (const t of traits) toolSupply[t]++
  const NO_CRAFT = []
  const sharedCount = () => {
    let total = 0
    for (const t of ownedTraits) if (counts[t] >= lo[t] && counts[t] <= hi[t]) total++
    return total
  }
  // Best score with each tool crafting one emblem (or none), and that crafting
  // as [{ tool, t }]: most counted traits, then most of the player's traits
  // kept (my-board mode). Only traits a +1 could lift into range are tried; a
  // crafting is kept only when it strictly beats crafting less.
  const scoreWithTools = () => {
    const base = score()
    const baseShared = sharedCount()
    if (tools.length === 0) return { traitCount: base, shared: baseShared, crafted: NO_CRAFT }
    let best = base
    let bestShared = baseShared
    let bestCrafted = NO_CRAFT
    const chosen = []
    const tryTool = k => {
      if (k === tools.length) {
        const total = score()
        const shared = sharedCount()
        if (total > best || (total === best && shared > bestShared)) {
          best = total
          bestShared = shared
          bestCrafted = chosen.slice()
        }
        return
      }
      tryTool(k + 1) // this tool makes nothing
      for (const t of tools[k].traits) {
        if (counts[t] >= lo[t] || counts[t] + tools.length < lo[t]) continue
        counts[t]++
        chosen.push({ tool: tools[k].tool, t })
        tryTool(k + 1)
        chosen.pop()
        counts[t]--
      }
    }
    tryTool(0)
    return { traitCount: best, shared: bestShared, crafted: bestCrafted }
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
      else if (traitSupply[t] + toolSupply[t] >= lo[t] - count) deficitsBySize[lo[t] - count]++
    }
    let budget = topSum(topWeight[i], remaining) + tools.length
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
  let penalty = 0 // my-board mode: penalty of the units picked so far
  let bought = 0 // my-board mode: units picked that the player doesn't own
  // My-board mode: buy at most the empty slots plus `maxSwaps` replacements
  // of the player's units (null = no cap).
  const maxBuys = boardMode && maxSwaps != null ? Math.max(0, size - owned.size) + maxSwaps : Infinity
  // ownedLeft[i]: owned units still pickable from class i on (groups once).
  const ownedLeft = new Array(classes.length + 1).fill(0)
  {
    const seenGroups = new Set()
    for (let i = classes.length - 1; i >= 0; i--) {
      const cls = classes[i]
      let add = 0
      if (cls.owned) {
        if (cls.group) { if (!seenGroups.has(cls.group)) { seenGroups.add(cls.group); add = 1 } } else add = cls.units.length
      }
      ownedLeft[i] = ownedLeft[i + 1] + add
    }
  }
  let nodes = 0
  let truncated = false

  // A board reached twice (see the 4th-evolution swap below) is kept once.
  const keptKeys = new Set()
  const keep = (candidate, candidatePicks) => {
    if (kept.length === limit && compare(candidate, kept[kept.length - 1]) <= 0) return
    const key = candidatePicks.join(',')
    if (keptKeys.has(key)) return
    let at = kept.length
    while (at > 0 && compare(candidate, kept[at - 1]) > 0) at--
    kept.splice(at, 0, { ...candidate, picks: candidatePicks })
    keptKeys.add(key)
    if (kept.length > limit) keptKeys.delete(kept.pop().picks.join(','))
  }

  const candidate = (traitCount, shared, bonus, candidateCost, candidatePenalty, crafted) => ({
    traitCount, shared, bonus, cost: candidateCost, crafted, penalty: candidatePenalty,
    score: boardMode ? weights.trait * traitCount + weights.sharedTrait * shared - candidatePenalty : traitCount,
  })
  const leaf = () => {
    if (requiredGroups.some(group => !groupsUsed.get(group))) return
    const { traitCount, shared, crafted } = scoreWithTools()
    if (bonusPick === -1) {
      keep(candidate(traitCount, shared, 0, cost, penalty, crafted), picks.slice())
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
    let bestChoiceCrafted = NO_CRAFT
    let bestChoiceShared = 0
    classes.forEach((cls, index) => {
      if (cls.group !== group || cls.bonus) return
      withVector(cls.vector, 1)
      const choice = scoreWithTools()
      if (choice.traitCount > bestChoice) {
        bestChoice = choice.traitCount
        bestIndex = index
        bestChoiceCrafted = choice.crafted
        bestChoiceShared = choice.shared
      }
      withVector(cls.vector, -1)
    })
    withVector(classes[bonusPick].vector, 1)
    if (traitCount > bestChoice) {
      keep(candidate(traitCount, shared, 1, cost, penalty, crafted), picks.slice())
    } else if (bestIndex !== -1) {
      const choicePicks = picks.slice()
      choicePicks[bonusPick] = 0
      choicePicks[bestIndex] = 1
      const choiceCost = cost - (classes[bonusPick].units[0].cost || 0) + (classes[bestIndex].units[0].cost || 0)
      const choicePenalty = penalty - classes[bonusPick].penaltyPrefix[1] + classes[bestIndex].penaltyPrefix[1]
      keep(candidate(bestChoice, bestChoiceShared, 0, choiceCost, choicePenalty, bestChoiceCrafted), choicePicks)
    }
  }

  const visit = (i, remaining) => {
    if (++nodes > nodeCap) { truncated = true; return }
    if (remaining === 0) { leaf(); return }
    if (i === classes.length) return
    if (requiredGroups.some(group => !groupsUsed.get(group) && groupLast.get(group) < i)) return
    if (bought + Math.max(0, remaining - ownedLeft[i]) > maxBuys) return
    if (kept.length === limit && boardMode) {
      // Best case: every reachable trait (as many of them the player's as are
      // not already past their range), at the least penalty still possible.
      // Strict: comps tying the worst kept score may be skipped.
      const bestTraits = bound(i, remaining)
      // The player's traits that are counted now or could still get there.
      let reachableShared = 0
      for (const t of ownedTraits) {
        const count = counts[t]
        if (count > hi[t]) continue
        if (count >= lo[t] || supply[i][t] + toolSupply[t] >= lo[t] - count) reachableShared++
      }
      const bestScore = weights.trait * bestTraits + weights.sharedTrait * Math.min(reachableShared, bestTraits)
        - penalty - topSum(lowPenalty[i], remaining)
      if (bestScore <= kept[kept.length - 1].score) return
    } else if (kept.length === limit) {
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
        penalty += cls.penaltyPrefix[take]
        if (boardMode && !cls.owned) bought += take
        if (cls.group) groupsUsed.set(cls.group, (groupsUsed.get(cls.group) || 0) + take)
        if (cls.bonus) bonusPick = i
      }
      picks[i] = take
      visit(i + 1, remaining - take)
      if (take > 0) {
        for (const [t, w] of cls.vector) counts[t] -= w * take
        for (const unit of cls.units.slice(0, take)) cost -= unit.cost || 0
        penalty -= cls.penaltyPrefix[take]
        if (boardMode && !cls.owned) bought -= take
        if (cls.group) groupsUsed.set(cls.group, groupsUsed.get(cls.group) - take)
        if (cls.bonus) bonusPick = -1
      }
      picks[i] = 0
    }
  }
  visit(0, open)

  const ownedUnits = boardMode ? (roster || []).filter(unit => owned.has(unit.id)) : []
  // My-board mode keeps the trait-count groups; within one, best score first
  // (the player's traits kept, then the least to buy).
  const comps = kept
    .map(entry => describeComp(entry, classes, fixed, ranges, emblemTraits, names, boardMode ? ownedUnits : null, ownedTraits))
    .sort((a, b) => b.traitCount - a.traitCount
      || (boardMode ? b.fromBoard.score - a.fromBoard.score || a.fromBoard.penalty - b.fromBoard.penalty : 0)
      || Number(a.bonusEvolution) - Number(b.bonusEvolution)
      || b.totalCost - a.totalCost
      || a.key.localeCompare(b.key))
  return { comps, truncated, tooManyRequired: false }
}

const byCostThenName = (a, b) => (a.champion.cost || 0) - (b.champion.cost || 0) || a.champion.name.localeCompare(b.champion.name)

function describeComp(
  { traitCount, bonus, picks, crafted = [], penalty = 0, score, shared = 0 },
  classes, fixed, ranges, emblemTraits, traitNames, ownedUnits, ownedTraits = [],
) {
  const craftedEmblems = crafted.map(({ tool, t }) => ({ tool, trait: traitNames[t] }))
  const ownedIds = new Set((ownedUnits || []).map(unit => unit.id))
  const units = fixed.map(champion => ({ champion, alternatives: [], required: true }))
  picks.forEach((take, i) => {
    const members = classes[i].units
    for (const champion of members.slice(0, take)) {
      const entry = { champion, alternatives: members.slice(take), required: false }
      if (ownedUnits) entry.owned = ownedIds.has(champion.id)
      units.push(entry)
    }
  })
  units.sort(byCostThenName)
  // My-board mode: how to get here from the player's units.
  const inComp = new Set(units.map(({ champion }) => champion.id))
  const fromBoard = ownedUnits ? {
    buy: units.filter(unit => !unit.owned).map(unit => unit.champion),
    sell: ownedUnits.filter(unit => !inComp.has(unit.id)),
    penalty,
    score,
    // The player's traits still counted here / all of the player's traits.
    sharedCount: shared,
    ownedTraitCount: ownedTraits.length,
    ownedTraits: ownedTraits.map(t => traitNames[t]),
  } : null

  const traitCounts = new Map()
  const add = (trait, n) => traitCounts.set(trait, (traitCounts.get(trait) || 0) + n)
  for (const { champion } of units) {
    for (const trait of champion.traits || []) add(trait, champion.traitWeights?.[trait] ?? 1)
  }
  for (const trait of emblemTraits) add(trait, 1)
  for (const { trait } of craftedEmblems) add(trait, 1)

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
    key: units.map(({ champion }) => [champion.id, ...(champion.chosenTraits || [])].join('+')).join('|')
      + craftedEmblems.map(({ trait }) => `#${trait}`).join(''),
    traitCount,
    bonusEvolution: bonus === 1,
    totalCost: units.reduce((sum, { champion }) => sum + (champion.cost || 0), 0),
    units,
    countedTraits: countedTraits.sort(byCount),
    otherTraits: otherTraits.sort(byCount),
    nearTraits: nearTraits.sort(byCount),
    // Emblems that put their trait in a counted tier, i.e. the ones in use.
    usedEmblemTraits: emblemTraits.filter(counted),
    // Emblems to make with the Spatula / Frying Pan held: [{ tool, trait }].
    craftedEmblems,
    // My-board mode: { buy, sell, penalty, score, sharedCount, ownedTraitCount, ownedTraits }; else null.
    fromBoard,
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

// The groups to render for the first `shown` comps, where the user can
// collapse whole trait counts (`collapsed`: Set of traitCount). A collapsed
// group is listed as its heading only and uses none of the `shown` budget, so
// the next tier moves straight up under it. Groups past the budget wait for
// the next page. visibleTotal (comps in expanded groups) caps the paging.
// -> { groups: [{ traitCount, total, collapsed, comps }], shownCount, visibleTotal }
export function pageGroups(comps, shown, collapsed = new Set()) {
  const groups = []
  let budget = shown
  let shownCount = 0
  let visibleTotal = 0
  // Set once an expanded group is cut short: nothing after it shows yet. A
  // collapsed heading still shows while everything above it is fully shown
  // (else trailing collapsed groups would never appear: nothing left to page).
  let cut = false
  for (const group of groupByTraitCount(comps || [])) {
    const total = group.comps.length
    if (collapsed.has(group.traitCount)) {
      if (!cut) groups.push({ traitCount: group.traitCount, total, collapsed: true, comps: [] })
      continue
    }
    visibleTotal += total
    if (cut || budget <= 0) { cut = true; continue }
    const take = Math.min(budget, total)
    groups.push({ traitCount: group.traitCount, total, collapsed: false, comps: group.comps.slice(0, take) })
    budget -= take
    shownCount += take
    if (take < total) cut = true
  }
  return { groups, shownCount, visibleTotal }
}

// For the widget: per tool, the emblem the most `comps` craft with it,
// [{ tool, trait, count }] (ties: trait name order).
export function bestCraftedEmblems(comps) {
  const tally = new Map() // tool -> Map(trait -> count)
  for (const comp of comps || []) {
    for (const { tool, trait } of comp.craftedEmblems || []) {
      if (!tally.has(tool)) tally.set(tool, new Map())
      const byTrait = tally.get(tool)
      byTrait.set(trait, (byTrait.get(trait) || 0) + 1)
    }
  }
  return Object.keys(CRAFT_COMPONENT_IDS)
    .filter(tool => tally.has(tool))
    .map(tool => {
      const [trait, count] = [...tally.get(tool)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
      return { tool, trait, count }
    })
}
