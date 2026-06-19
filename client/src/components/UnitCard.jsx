import StatIcon from './StatIcon.jsx'
import DetailCardShell from './shared/DetailCardShell.jsx'
import { tokenize } from '../utils/descriptionTokenizer.js'
import styles from './UnitCard.module.css'

const COST_COLORS = {
  1: 'var(--cost-1)',
  2: 'var(--cost-2)',
  3: 'var(--cost-3)',
  4: 'var(--cost-4)',
  5: 'var(--cost-5)',
}

function AbilityDesc({ desc, variables, championId, stats }) {
  const nodes = tokenize(desc, variables, championId, stats)
  if (nodes.length === 0) return null

  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'var') {
          return <strong key={i} className={styles.scaling}>{node.content}</strong>
        }
        if (node.type === 'icon') {
          return <StatIcon key={i} type={node.iconType} />
        }
        if (node.type === 'buff') {
          return <span key={i} className={styles.buffName}>{node.content}</span>
        }
        if (node.type === 'plus') {
          return <span key={i} className={styles.opPlus}> + </span>
        }
        return <span key={i}>{node.content}</span>
      })}
    </>
  )
}

function ManaBar({ initialMana, mana }) {
  const pct = mana > 0 ? Math.min(100, (initialMana / mana) * 100) : 0
  return (
    <div className={styles.manaSection}>
      <span className={styles.manaLabel}>
        {initialMana} / {mana} mana
      </span>
      <div className={styles.manaTrack}>
        <div className={styles.manaFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function UnitCard({ isOpen, data: champion, style, mode, onClose }) {
  if (!isOpen || !champion) return null

  const borderColor = COST_COLORS[champion.cost] || 'var(--ghost-border)'

  return (
    <DetailCardShell mode={mode} style={style} onClose={onClose} cardClassName={styles.card} label={champion.name}>
      <div className={styles.header}>
        <img
          src={champion.iconUrl}
          alt={champion.name}
          className={styles.portrait}
          style={{ borderColor }}
          draggable={false}
        />
        <div className={styles.headerInfo}>
          <span className={styles.name}>{champion.name}</span>
          <div className={styles.traits}>
            {(champion.traits || []).map(t => (
              <span key={t} className={styles.traitTag}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {champion.stats && (
        <ManaBar
          initialMana={champion.stats.initialMana}
          mana={champion.stats.mana}
        />
      )}

      {champion.ability && (
        <div className={styles.ability}>
          <div className={styles.abilityHeader}>
            {champion.ability.iconUrl && (
              <img
                src={champion.ability.iconUrl}
                alt=""
                className={styles.abilityIcon}
                draggable={false}
              />
            )}
            <span className={styles.abilityName}>{champion.ability.name}</span>
          </div>
          <p className={styles.abilityDesc}>
            <AbilityDesc
              desc={champion.ability.desc}
              variables={champion.ability.variables}
              championId={champion.id}
              stats={champion.stats}
            />
          </p>
        </div>
      )}
    </DetailCardShell>
  )
}
