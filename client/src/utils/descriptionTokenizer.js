import { lookupBuffName } from '../data/buffNames.js'
import { getFormula } from '../data/abilityFormulas.js'

// Map CDragon scaling suffix → StatIcon type prop
const SCALE_ICON_TYPE = {
  ap: 'ap',
  ad: 'ad',
  health: 'hp',
  armor: 'armor',
  mr: 'mr',
  as: 'as',
  attackspeed: 'as',
  // Set 18 additions: damage reduction, mana regen, damage amp.
  dr: 'durability',
  manaregen: 'mana',
  da: 'amp',
}

// Strip CDragon HTML tags and entities from a literal text segment.
// {{...}} and %I:Scale*% are now handled by the tokenizer, not here.
export function stripMarkup(str) {
  return str
    .replace(/<br\s*\/?>/gi, ' ')
    // Set 18 CDragon text contains literal "\n" escape sequences and CRLFs.
    .replace(/\\n|\r?\n/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\(\s*\)/g, '')
}

// Match a %I:Scale<Stat>% or %I:set14AmpIcon% reference; returns icon type or null.
export function matchScaleRef(str) {
  if (!str) return null
  const lower = str.toLowerCase()
  if (lower === '%i:set14ampicon%') return 'amp'
  const m = /^%i:scale([a-z]+)%$/i.exec(str)
  if (!m) return null
  return SCALE_ICON_TYPE[m[1].toLowerCase()] || null
}

// Look up a variable by name. CDragon descriptions often reference @ModifiedXxx@
// where the actual variable is named Xxx — try stripping the "Modified" prefix
// as a fallback.
export function findVariable(variables, rawName) {
  if (!variables || variables.length === 0) return null
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = norm(rawName)

  let v = variables.find(x => norm(x.name) === target)
  if (v) return v

  const stripped = target.replace(/^modified/, '')
  if (stripped !== target) {
    v = variables.find(x => norm(x.name) === stripped)
    if (v) return v
  }
  return null
}

// Round to 2 decimal places.
export const round2 = (n) => Math.round(n * 100) / 100

// Format a star-level value array into a display string. Applies rounding,
// optional percent conversion, and collapses to a single value if all three
// star levels are equal (common for fixed-percent scalings like 15% HP, or
// for items which only ever have a single value).
export function formatValues(rawValues, percent) {
  const vals = [1, 2, 3].map(i => {
    const raw = rawValues?.[i] ?? rawValues?.[rawValues?.length - 1] ?? 0
    return round2(raw)
  })
  const display = vals.map(n => {
    if (n < 1) {
      const rounded = round2(n)
      const percentage = Math.round(rounded * 100)
      return `${percentage}%`
    }
    return percent ? `${round2(n * 100)}%` : String(n)
  })
  const unique = [...new Set(display)]
  return unique.join('/')
}

// Tokenize a CDragon ability/item description into renderable nodes:
//  { type: 'text', content }   — literal text (cleaned)
//  { type: 'var',  content }   — star-level scaling values "s1/s2/s3"
//  { type: 'icon', iconType }  — stat icon for %I:ScaleX% references
//  { type: 'buff', content }   — buff name for {{TFT_*}} references (rainbow text)
//  { type: 'plus' }            — " + " separator between formula segments
export function tokenize(desc, variables, championId, stats) {
  if (!desc) return []
  // Three capture groups: (1) buff ref {{...}}, (2) scale/amp icon %i:...%, (3) variable @...@
  const TOKEN_RE = /(\{\{[^}]+\}\})|(%i:scale[a-z]+%|%i:set14ampicon%)|@([^@]+)@/gi
  // After a formula match, eat the immediately following parenthetical that
  // contains only stat-scale icons — those icons are now emitted inline by the
  // formula and would otherwise duplicate. Tolerate `&nbsp;` (CDragon puts
  // these between the token and the parenthetical) and HTML close-tags like
  // `</scaleHealth>`, `</TFTBonus>`, etc. that wrap the token group.
  const GAP = '(?:\\s|&nbsp;|</[^>]+>|<[^>]+>)*'
  const SCALE_GROUP_RE = new RegExp(
    `^${GAP}[(（]${GAP}((?:%i:(?:scale[a-z]+|set14ampicon)%${GAP})+)[)）]`,
    'i',
  )
  // Set 18 descriptions put the scale icons right after the token with no
  // parentheses ("@PhysicalDamageCalc1@ %i:scaleAD%%i:scaleAP% physical damage").
  const BARE_SCALE_RE = new RegExp(`^${GAP}(?:%i:(?:scale[a-z]+|set14ampicon)%${GAP})+`, 'i')

  const nodes = []
  let last = 0

  const pushText = (raw) => {
    const cleaned = stripMarkup(raw).replace(/\s+/g, ' ')
    if (cleaned) nodes.push({ type: 'text', content: cleaned })
  }

  // Emit the parts of a formula. `parts` is the array returned by a formula fn.
  const emitFormulaParts = (parts) => {
    let firstValueEmitted = false
    for (const part of parts) {
      if (part.text != null) {
        nodes.push({ type: 'text', content: part.text })
        continue
      }
      if (part.iconOnly) {
        nodes.push({ type: 'icon', iconType: part.iconOnly })
        continue
      }
      if (Array.isArray(part.values)) {
        if (firstValueEmitted) nodes.push({ type: 'plus' })
        const formatted = formatValues(part.values, part.percent)
        nodes.push({ type: 'var', content: formatted })
        if (part.icon) nodes.push({ type: 'icon', iconType: part.icon })
        firstValueEmitted = true
      }
    }
  }

  let m
  while ((m = TOKEN_RE.exec(desc)) !== null) {
    if (m.index > last) pushText(desc.slice(last, m.index))
    last = m.index + m[0].length

    const [, buffMatch, scaleMatch, varMatch] = m

    if (buffMatch) {
      const ref = buffMatch.slice(2, -2) // strip {{ }}
      nodes.push({ type: 'buff', content: lookupBuffName(ref) })
      continue
    }

    if (scaleMatch) {
      const iconType = matchScaleRef(scaleMatch)
      if (iconType) nodes.push({ type: 'icon', iconType })
      continue
    }

    if (varMatch) {
      // CDragon often wraps scaling refs as @%I:ScaleAp%@ — emit icon, not skip.
      const wrappedScale = matchScaleRef(varMatch)
      if (wrappedScale) {
        nodes.push({ type: 'icon', iconType: wrappedScale })
        continue
      }

      // Other %-prefixed tokens (e.g. @%I:SomethingElse@) — unresolvable, skip.
      if (varMatch.startsWith('%')) continue

      const [rawName, modifier] = varMatch.split('*')
      const multiplier = modifier ? parseFloat(modifier) / 100 : 1

      // Try the per-champion formula registry first.
      const formulaFn = getFormula(championId, rawName)
      if (formulaFn) {
        const parts = formulaFn({ vars: variables || [], stats: stats || {} })
        // Apply multiplier if there was a *N suffix on the token
        const adjusted = multiplier === 1 ? parts : parts.map(p =>
          Array.isArray(p.values)
            ? { ...p, values: p.values.map(x => x * multiplier) }
            : p
        )
        emitFormulaParts(adjusted)

        // Consume the following parenthetical of stat-scale icons if present.
        // TOKEN_RE has the /g flag so it tracks its own lastIndex — bump it
        // forward as well, otherwise the next exec() restarts inside the
        // consumed range and re-emits the very icons we just skipped.
        const ahead = desc.slice(last)
        const m2 = SCALE_GROUP_RE.exec(ahead)
        if (m2) {
          last += m2[0].length
          TOKEN_RE.lastIndex = last
        }
        continue
      }

      // Fallback: generic variable lookup.
      const variable = findVariable(variables, rawName)
      if (!variable || !Array.isArray(variable.value)) {
        // Unresolved value (CDragon ships no data for it): also drop the scale
        // icons that annotate it, otherwise they render orphaned mid-sentence.
        const ahead = desc.slice(last)
        const m2 = SCALE_GROUP_RE.exec(ahead) || BARE_SCALE_RE.exec(ahead)
        if (m2) {
          last += m2[0].length
          TOKEN_RE.lastIndex = last
        }
        continue
      }
      const scaledValues = variable.value.map(x => x * multiplier)
      nodes.push({ type: 'var', content: formatValues(scaledValues, false) })
    }
  }

  if (last < desc.length) pushText(desc.slice(last))
  return nodes
}
