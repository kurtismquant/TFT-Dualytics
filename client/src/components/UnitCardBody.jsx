import AbilityDescription from './shared/AbilityDescription.jsx'
import styles from './UnitCard.module.css'

const COST_COLORS = {
  1: 'var(--cost-1)',
  2: 'var(--cost-2)',
  3: 'var(--cost-3)',
  4: 'var(--cost-4)',
  5: 'var(--cost-5)',
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

// A unit's detail content: portrait, name, traits, mana and ability. Shared by
// the hover UnitCard and the Team Builder's unit inspector panel, which adds a
// `headerAction` (its close button) and `children` under the header (its trait
// picker).
export default function UnitCardBody({ champion, headerAction, children }) {
  const borderColor = COST_COLORS[champion.cost] || 'var(--ghost-border)'

  return (
    <>
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
        {headerAction}
      </div>

      {children}

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
            <AbilityDescription
              desc={champion.ability.desc}
              variables={champion.ability.variables}
              championId={champion.id}
              stats={champion.stats}
              calculations={champion.ability.calculations}
            />
          </p>
        </div>
      )}
    </>
  )
}
