import { useTranslation } from 'react-i18next'
import StatIcon from '../StatIcon.jsx'
import ItemDescription from '../shared/ItemDescription.jsx'
import { HoverableItem } from '../shared/HoverableBoardPieces.jsx'
import { buildItemPath } from '../../constants/routes.js'
import { itemComponents, visibleItemStats } from '../../utils/itemStats.js'
import styles from './ItemOverview.module.css'

// The item card's content laid out for the item stats page: the effect text
// beside its stat bonuses and recipe. Recipe components link to their own pages.
export default function ItemOverview({ item, allItems, patch }) {
  const { t } = useTranslation()
  if (!item) return null
  const stats = visibleItemStats(item)
  const components = itemComponents(item, allItems)

  return (
    <section className={styles.overview} aria-label={t('item.overviewLabel', { name: item.name })}>
      {item.desc && (
        <div>
          <p className={styles.kicker}>{t('item.descriptionLabel')}</p>
          <p className={styles.desc}>
            <ItemDescription desc={item.desc} effects={item.effects} calculations={item.calculations} />
          </p>
        </div>
      )}

      {(stats.length > 0 || components.length > 0) && (
        <div className={styles.side}>
          {stats.length > 0 && (
            <div>
              <p className={styles.kicker}>{t('item.statsLabel')}</p>
              <dl className={styles.stats}>
                {stats.map(stat => (
                  <div key={stat.label} className={styles.statRow}>
                    <dt className={styles.statName}>
                      <StatIcon type={stat.icon} size={14} />
                      {stat.label}
                    </dt>
                    <dd className={styles.statValue}>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {components.length > 0 && (
            <div>
              <p className={styles.kicker}>{t('item.recipeLabel')}</p>
              <div className={styles.recipe}>
                {components.map((component, i) => (
                  <span key={component.id} className={styles.component}>
                    {i > 0 && <span className={styles.plus} aria-hidden="true">+</span>}
                    <HoverableItem
                      item={component}
                      allItems={allItems}
                      size={36}
                      href={buildItemPath(component.apiName || component.id, patch)}
                    />
                    <span className={styles.componentName}>{component.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
