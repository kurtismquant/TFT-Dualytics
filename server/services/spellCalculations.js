// Evaluates the mSpellCalculations block of a CDragon character bin
// (raw.communitydragon.org/latest/game/characters/<apiname>.cdtb.bin.json) into
// the tooltip values the client tokenizer renders:
//   { [name]: [{ values: [_, 1★, 2★, 3★], percent? }] }
// Ability descriptions reference calculations by name (@MagicDamageCalc1@,
// @ModifiedDamage@); en_us.json's `variables` only carries the raw DataValues
// they're built from, so without this those tokens never resolve.
//
// The game shows each calculation as one summed number and draws the scale
// icons from the description text itself ("@PhysicalDamageCalc1@
// %i:scaleAD%%i:scaleAP%"), so the result carries no icons. Values are computed
// at the tooltip baseline: 100 AP, 100% AD, and the unit's base stats scaled by
// star level. Anything depending on live combat state (buff stacks, range,
// unknown stats) makes that calculation unsupported — skipped, never guessed.

// TFT star-level multiplier for base AD and HP. Index 0 is unused (DataValues
// arrays are [_, 1★, 2★, 3★, ...]).
const STAR_MULT = [1, 1, 1.8, 3.24]
const STARS = [0, 1, 2, 3]

// TFT's stat enum as used by calculation parts (it diverges from League's).
// Ids confirmed against Set 14–17 bins by the scale icons their tooltips show.
const STAT_BASELINE = {
  0: () => 100, // Ability Power
  1: (s) => s.armor,
  2: (s, star) => s.damage * STAR_MULT[star], // total Attack Damage
  3: () => 1, // Attack Damage as a multiplier (100%)
  4: (s) => s.attackSpeed,
  6: (s) => s.magicResist,
  12: (s, star) => s.hp * STAR_MULT[star], // max Health
}
const BONUS_STAT_FORMULA = 2

class Unsupported extends Error {}

// Riot placeholder spell: every Set 18 DA_ unit currently ships this instead of
// real data (the numbers live in a system CDragon doesn't extract yet).
export const isTemplateSpell = (mSpell) => {
  const names = (mSpell?.DataValues || []).map(d => d.name)
  return names.length === 0 || names.join(',') === 'DataValue,OtherValue'
}

// The unit's cast ability: the SpellObject carrying DataValues that isn't one
// of its basic/crit attacks.
export const pickAbilitySpell = (bin) => {
  if (!bin || typeof bin !== 'object') return null
  for (const [key, obj] of Object.entries(bin)) {
    if (obj?.__type !== 'SpellObject' || !obj.mSpell?.DataValues) continue
    if (/attack/i.test(key.split('/').pop())) continue
    return obj.mSpell
  }
  return null
}

export const evaluateCalculations = (mSpell, stats) => {
  if (!mSpell || isTemplateSpell(mSpell)) return null
  const s = { damage: 0, hp: 0, armor: 0, magicResist: 0, attackSpeed: 0, ...stats }

  const norm = (n) => String(n).toLowerCase()
  const dataValues = new Map(
    (mSpell.DataValues || []).map(d => [norm(d.name), STARS.map(i => d.values?.[i] ?? 0)]),
  )
  const calcs = mSpell.mSpellCalculations || {}
  const calcByName = new Map(Object.entries(calcs).map(([k, v]) => [norm(k), v]))

  const dataValue = (name) => {
    const v = dataValues.get(norm(name))
    if (!v) throw new Unsupported(`DataValue ${name}`)
    return v
  }
  const stat = (id, formula) => {
    const base = STAT_BASELINE[id ?? 0]
    if (!base) throw new Unsupported(`stat ${id}`)
    // Bonus stats are 0 at the tooltip baseline.
    return STARS.map(i => (formula === BONUS_STAT_FORMULA ? 0 : base(s, i)))
  }
  const mul = (a, b) => a.map((x, i) => x * b[i])
  const add = (a, b) => a.map((x, i) => x + b[i])
  const sum = (arrs) => arrs.reduce(add, STARS.map(() => 0))

  const evalPart = (part, depth) => {
    if (depth > 20) throw new Unsupported('recursion')
    switch (part?.__type) {
      case 'NamedDataValueCalculationPart':
        return dataValue(part.mDataValue)
      case 'NumberCalculationPart':
        return STARS.map(() => part.mNumber ?? 0)
      case 'SumOfSubPartsCalculationPart':
        return sum((part.mSubparts || []).map(p => evalPart(p, depth + 1)))
      case 'ProductOfSubPartsCalculationPart':
        return mul(evalPart(part.mPart1, depth + 1), evalPart(part.mPart2, depth + 1))
      case 'SubPartScaledProportionalToStat':
        return mul(evalPart(part.mSubpart, depth + 1), stat(part.mStat))
          .map(x => x * (part.mRatio ?? 1))
      case 'StatByNamedDataValueCalculationPart':
        return mul(dataValue(part.mDataValue), stat(part.mStat, part.mStatFormula))
      case 'StatByCoefficientCalculationPart':
        return stat(part.mStat, part.mStatFormula).map(x => x * (part.mCoefficient ?? 1))
      case 'StatBySubPartCalculationPart':
        return mul(evalPart(part.mSubpart, depth + 1), stat(part.mStat, part.mStatFormula))
      case 'ClampSubPartsCalculationPart': {
        const lo = part.mFloor ?? -Infinity
        const hi = part.mCeiling ?? Infinity
        return sum((part.mSubparts || []).map(p => evalPart(p, depth + 1)))
          .map(x => Math.min(hi, Math.max(lo, x)))
      }
      // CDragon hasn't named this type; it references another calculation.
      case '{f3cbe7b2}':
        return evalCalc(part.mSpellCalculationKey, depth + 1)
      default:
        throw new Unsupported(part?.__type)
    }
  }

  const evalCalc = (name, depth) => {
    const calc = calcByName.get(norm(name))
    if (!calc) throw new Unsupported(`calc ${name}`)
    if (calc.__type === 'GameCalculationModified') {
      return mul(evalCalc(calc.mModifiedGameCalculation, depth + 1), evalPart(calc.mMultiplier, depth + 1))
    }
    if (calc.__type !== 'GameCalculation') throw new Unsupported(calc.__type)
    return sum((calc.mFormulaParts || []).map(p => evalPart(p, depth + 1)))
  }

  const out = {}
  // Raw DataValues first so tokens like @Duration@ resolve; calculations with
  // the same name take precedence.
  for (const d of mSpell.DataValues || []) {
    out[d.name] = [{ values: STARS.map(i => d.values?.[i] ?? 0) }]
  }
  for (const [name, calc] of Object.entries(calcs)) {
    try {
      const part = { values: evalCalc(name, 0) }
      if (calc.mDisplayAsPercent === true) part.percent = true
      out[name] = [part]
    } catch (err) {
      if (!(err instanceof Unsupported)) throw err
    }
  }
  return out
}
