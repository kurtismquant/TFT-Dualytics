import { lookupBuffName } from '../data/buffNames.js'
import { findVariable } from '../utils/descriptionTokenizer.js'
import StatIcon from './StatIcon.jsx'
import DetailCardShell from './shared/DetailCardShell.jsx'
import styles from './TraitCard.module.css'

const SCALE_TEXT = {
  ap: 'AP',
  ad: 'AD',
  health: 'HP',
  healthregen: 'HP Regen',
  hpregen: 'HP Regen',
  armor: 'Armor',
  mr: 'MR',
  as: 'AS',
  attackspeed: 'AS',
}

const COST_COLORS = {
  1: 'var(--cost-1)',
  2: 'var(--cost-2)',
  3: 'var(--cost-3)',
  4: 'var(--cost-4)',
  5: 'var(--cost-5)',
}

const STYLE_TIER = {
  1: 'style1',
  2: 'style2',
  3: 'style3',
  4: 'style4',
  5: 'style5',
  6: 'style6',
}

// Split a trait desc into a preamble, ordered list of <row>/<expandRow> bodies, and a single <rules> body.
// Preamble = anything before the first row tag (some traits use it for static lore or shared mechanics).
// Falls back to a single synthetic row holding the whole desc if no row tags exist.
function splitRowsAndRules(desc) {
  if (!desc) return { preamble: '', rows: [], rules: '' }
  const rows = []
  const rowRe = /<(row|expandRow)>([\s\S]*?)<\/\1>/gi
  let m
  let firstRowIdx = -1
  while ((m = rowRe.exec(desc)) !== null) {
    if (firstRowIdx === -1) firstRowIdx = m.index
    rows.push(m[2])
  }

  const rulesMatch = /<rules>([\s\S]*?)<\/rules>/i.exec(desc)
  const rules = rulesMatch ? rulesMatch[1] : ''

  let preamble = ''
  if (firstRowIdx > 0) {
    preamble = desc.slice(0, firstRowIdx)
  }

  if (rows.length === 0) {
    // Fallback: strip rules block, treat the rest as one row, no preamble.
    const stripped = desc.replace(/<rules>[\s\S]*?<\/rules>/gi, '').trim()
    if (stripped) rows.push(stripped)
  }

  return { preamble, rows, rules }
}

// Render a numeric value with a *N modifier already applied.
// Integers render plain; otherwise round to 1 decimal. Trailing % is added by surrounding desc text.
function fmtNumber(v) {
  if (v == null || Number.isNaN(v)) return ''
  if (Number.isInteger(v)) return String(v)
  return String(parseFloat(v.toFixed(1)))
}

// Resolve scaling marker like %i:scaleAS% → " (AS)"; returns '' if unknown.
function scaleLabel(suffix) {
  const label = SCALE_TEXT[suffix.toLowerCase()]
  return label ? ` (${label})` : ''
}

// Tokenize one row/rules body into an array of React-renderable nodes (strings + buff spans).
// Substitutes @Var@ / @Var*N@ from the tier's variables, with MinUnits sourced from the effect.
function resolveTokens(text, variables, minUnits, keyPrefix) {
  if (!text) return []
  // 1. Strip <br> and any other stray HTML tags but preserve {{...}} and %i:...% markers.
  let working = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // Match buff refs, scale markers, or @var@ tokens.
  const TOKEN_RE = /(\{\{([^}]+)\}\})|(%i:([a-zA-Z0-9]+)%)|@([^@]+)@/gi
  const nodes = []
  let last = 0
  let key = 0
  let mm

  while ((mm = TOKEN_RE.exec(working)) !== null) {
    if (mm.index > last) nodes.push(working.slice(last, mm.index))
    last = mm.index + mm[0].length

    const [, buffWhole, buffRef, , scaleSuffix, varToken] = mm

    if (buffWhole) {
      nodes.push(
        <span key={`${keyPrefix}-b-${key++}`} className={styles.buffName}>
          {lookupBuffName(buffRef)}
        </span>,
      )
      continue
    }

    if (scaleSuffix) {
      if (scaleSuffix.toLowerCase() === 'set14ampicon') {
        nodes.push(<StatIcon key={`${keyPrefix}-i-${key++}`} type="amp" />)
      } else {
        const label = scaleLabel(scaleSuffix)
        if (label) nodes.push(label)
      }
      continue
    }

    if (varToken) {
      const [rawName, modifier] = varToken.split('*')
      const multiplier = modifier ? parseFloat(modifier) : 1

      // MinUnits is implicit per-tier — never stored in variables.
      if (rawName.toLowerCase() === 'minunits') {
        nodes.push(fmtNumber(minUnits * multiplier))
        continue
      }

      const variable = findVariable(variables, rawName)
      const raw = variable?.value
      if (raw == null || typeof raw !== 'number') continue
      nodes.push(fmtNumber(raw * multiplier))
    }
  }

  if (last < working.length) nodes.push(working.slice(last))

  // Collapse adjacent string nodes; trim orphan empty parens and extra whitespace.
  const merged = []
  for (const n of nodes) {
    if (typeof n === 'string' && merged.length && typeof merged[merged.length - 1] === 'string') {
      merged[merged.length - 1] += n
    } else {
      merged.push(n)
    }
  }
  return merged
    .map(n =>
      typeof n === 'string'
        ? n.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ')
        : n,
    )
    .filter(n => (typeof n === 'string' ? n.length > 0 : true))
}

export default function TraitCard({ isOpen, data, style, allChampions, mode, onClose }) {
  if (!isOpen || !data) return null
  const { meta, count } = data

  const effects = (meta.effects || [])
    .filter(e => e.minUnits > 0)
    .sort((a, b) => a.minUnits - b.minUnits)

  const { preamble, rows, rules } = splitRowsAndRules(meta.desc)

  // Active tier index: highest effect whose minUnits ≤ count.
  let activeIdx = -1
  for (let i = 0; i < effects.length; i++) {
    if (count >= effects[i].minUnits) activeIdx = i
    else break
  }

  // For <rules>, use the highest-tier variables (passive lives on top tier).
  const rulesVars = effects.length ? effects[effects.length - 1].variables : []
  const rulesMin = effects.length ? effects[effects.length - 1].minUnits : 0

  const championsWithTrait = (allChampions || [])
    .filter(c => (c.traits || []).includes(meta.name))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))

  const activeStyle = activeIdx >= 0 ? STYLE_TIER[effects[activeIdx].style] : null

  return (
    <DetailCardShell mode={mode} style={style} onClose={onClose} cardClassName={styles.card} label={meta.name}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {meta.iconUrl && (
            <img src={meta.iconUrl} alt="" className={styles.traitIcon} draggable={false} />
          )}
          <span className={styles.traitName}>{meta.name}</span>
        </div>
        {effects.length > 0 && (
          <div className={styles.breakpoints}>
            {effects.map((effect, i) => {
              const isActive = i === activeIdx
              const isHit = i <= activeIdx
              const tierName = STYLE_TIER[effect.style]
              const cls = [
                styles.bp,
                isActive && tierName ? styles[`bp_${tierName}`] : '',
                isHit && !isActive ? styles.bpHit : '',
                !isHit ? styles.bpInactive : '',
              ].filter(Boolean).join(' ')
              return (
                <span key={effect.minUnits} className={styles.bpGroup}>
                  <span className={cls}>{effect.minUnits}</span>
                  {i < effects.length - 1 && <span className={styles.bpSep}>{'>'}</span>}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {preamble && preamble.replace(/<[^>]+>/g, '').trim() && (
        <p className={styles.preamble}>
          {resolveTokens(preamble, rulesVars, rulesMin, 'pre')}
        </p>
      )}

      {rows.length > 0 && (
        <div className={styles.rows}>
          {rows.map((row, i) => {
            const effect = effects[i] || effects[effects.length - 1] || { minUnits: 0, variables: [] }
            const isActive = count >= effect.minUnits
            const tokens = resolveTokens(row, effect.variables, effect.minUnits, `r${i}`)
            return (
              <p key={i} className={`${styles.row} ${isActive ? styles.rowActive : styles.rowInactive}`}>
                {tokens}
              </p>
            )
          })}
        </div>
      )}

      {rules && (
        <p className={styles.rules}>
          {resolveTokens(rules, rulesVars, rulesMin, 'rules')}
        </p>
      )}

      {championsWithTrait.length > 0 && (
        <div className={`${styles.champions} ${activeStyle ? styles[`champTier_${activeStyle}`] : ''}`}>
          {championsWithTrait.map(c => (
            <div
              key={c.id}
              className={styles.champRing}
              style={{ borderColor: COST_COLORS[c.cost] || 'var(--ghost-border)' }}
              title={c.name}
            >
              <img
                src={c.iconUrl}
                alt={c.name}
                className={styles.champPortrait}
                draggable={false}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </DetailCardShell>
  )
}
