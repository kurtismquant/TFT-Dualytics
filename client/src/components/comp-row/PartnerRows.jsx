import PartnerRow from './PartnerRow.jsx'
import styles from '../CompRow.module.css'

export default function PartnerRows({ partners, champions, items, traits, parentGames, uniqueTraitIds }) {
  const hasPartners = partners && partners.length > 0

  return (
    <>
      {hasPartners ? (
        <div role="list">
          {partners.map(partner => (
            <PartnerRow
              key={partner.fingerprint}
              partner={partner}
              champions={champions}
              items={items}
              traits={traits}
              parentGames={parentGames}
              uniqueTraitIds={uniqueTraitIds}
            />
          ))}
        </div>
      ) : (
        <div className={styles.expandedEmpty} role="status">
          No teammate comp data available yet.
        </div>
      )}
    </>
  )
}
