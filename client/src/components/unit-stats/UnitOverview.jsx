import { useTranslation } from 'react-i18next'
import AbilityDescription from '../shared/AbilityDescription.jsx'
import StatIcon from '../StatIcon.jsx'
import { formatStarValues, statByStar, STAR_DAMAGE_MULTIPLIERS, STAR_HEALTH_MULTIPLIERS } from '../../utils/unitStats.js'
import styles from './UnitOverview.module.css'

// The unit card's content laid out for the unit stats page: the ability (icon,
// mana, description with its values) beside the unit's traits and base stats.
export default function UnitOverview({ champion, traits }) {
  const { t } = useTranslation()
  if (!champion) return null
  const { ability, stats } = champion
  const traitMeta = (champion.traits || []).map(name => traits?.find(trait => trait.name === name) || { name })

  const statRows = stats ? [
    { key: 'health', icon: 'hp', value: formatStarValues(statByStar(stats.hp, STAR_HEALTH_MULTIPLIERS)) },
    { key: 'attackDamage', icon: 'ad', value: formatStarValues(statByStar(stats.damage, STAR_DAMAGE_MULTIPLIERS)) },
    { key: 'attackSpeed', icon: 'as', value: stats.attackSpeed ? Number(stats.attackSpeed).toFixed(2) : '–' },
    { key: 'armor', icon: 'armor', value: stats.armor ?? '–' },
    { key: 'magicResist', icon: 'mr', value: stats.magicResist ?? '–' },
    { key: 'range', icon: 'range', value: stats.range ?? '–' },
  ] : []

  return (
    <section className={styles.overview} aria-label={t('unit.overviewLabel', { name: champion.name })}>
      {ability && (
        <div className={styles.ability}>
          <p className={styles.kicker}>{t('unit.ability')}</p>
          <div className={styles.abilityHeader}>
            {ability.iconUrl && <img src={ability.iconUrl} alt="" className={styles.abilityIcon} draggable={false} />}
            <div className={styles.abilityTitle}>
              <h2 className={styles.abilityName}>{ability.name}</h2>
              {stats && (
                <div className={styles.mana}>
                  <span>{t('unit.manaReadout', { start: stats.initialMana, max: stats.mana })}</span>
                  <span className={styles.manaTrack} aria-hidden="true">
                    <span
                      className={styles.manaFill}
                      style={{ width: `${stats.mana > 0 ? Math.min(100, (stats.initialMana / stats.mana) * 100) : 0}%` }}
                    />
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className={styles.abilityDesc}>
            <AbilityDescription
              desc={ability.desc}
              variables={ability.variables}
              championId={champion.id}
              stats={stats}
              calculations={ability.calculations}
            />
          </p>
        </div>
      )}

      <div className={styles.unitInfo}>
        {traitMeta.length > 0 && (
          <>
            <p className={styles.kicker}>{t('unit.traitsLabel')}</p>
            <ul className={styles.traits}>
              {traitMeta.map(trait => (
                <li key={trait.name} className={styles.trait}>
                  {trait.iconUrl && <img src={trait.iconUrl} alt="" className={styles.traitIcon} draggable={false} />}
                  <span>{trait.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {statRows.length > 0 && (
          <>
            <p className={styles.kicker}>
              {t('unit.baseStats')} <span className={styles.perStar}>{t('unit.perStar')}</span>
            </p>
            <dl className={styles.stats}>
              {statRows.map(row => (
                <div key={row.key} className={styles.statRow}>
                  <dt className={styles.statName}>
                    <StatIcon type={row.icon} size={14} />
                    {t(`unit.stat.${row.key}`)}
                  </dt>
                  <dd className={styles.statValue}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  )
}
