import { useTranslation } from 'react-i18next'
import ItemIcon from '../ItemIcon.jsx'
import statsStyles from '../../pages/StatsPage.module.css'
import styles from './BronzeComps.module.css'

function Checkbox({ checked, onChange, children }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

// The "more options" panel: every checkbox and dropdown, in three groups.
// `choiceUnitNames`: trait-choice units in this set (Kha'Zix); none hides
// their options. `choiceMax`: most traits such a unit picks from; the
// evolutions dropdown chooses how many it has.
export default function BronzeOptions({ id, filters, setFilter, toolItems, choiceUnitNames = [], choiceMax = 0 }) {
  const { t } = useTranslation()
  const choiceUnits = choiceUnitNames.join(' / ')
  return (
    <div id={id} className={styles.optionsPanel}>
      <fieldset className={styles.optionGroup}>
        <legend className={styles.optionLegend}>{t('bronze.optionsCounting')}</legend>
        <Checkbox checked={filters.includeSilverGold} onChange={value => setFilter('includeSilverGold', value)}>
          {t('bronze.includeSilverGold')}
        </Checkbox>
        <Checkbox checked={filters.boardMode} onChange={value => setFilter('boardMode', value)}>
          {t('bronze.boardMode')}
        </Checkbox>
      </fieldset>
      <fieldset className={styles.optionGroup}>
        <legend className={styles.optionLegend}>{t('bronze.optionsUnits')}</legend>
        <Checkbox checked={filters.excludeLegendary} onChange={value => setFilter('excludeLegendary', value)}>
          {t('bronze.excludeLegendary')}
        </Checkbox>
        {choiceUnitNames.length > 0 && (
          <Checkbox checked={filters.excludeChoiceUnits} onChange={value => setFilter('excludeChoiceUnits', value)}>
            {t('bronze.excludeChoiceUnits', { units: choiceUnits })}
          </Checkbox>
        )}
        {choiceUnitNames.length > 0 && !filters.excludeChoiceUnits && choiceMax > 0 && (
          <label className={styles.selectLabel}>
            <span>{t('bronze.choiceTraitsLabel', { units: choiceUnits })}</span>
            <select
              className={`${statsStyles.select} ${styles.choiceSelect}`}
              value={Math.min(filters.choiceTraitCount, choiceMax)}
              onChange={event => { setFilter('choiceTraitCount', Number(event.target.value)); event.target.blur() }}
            >
              {Array.from({ length: choiceMax }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{t('bronze.choiceTraitsOption', { count: n })}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      <fieldset className={styles.optionGroup}>
        <legend className={styles.optionLegend}>{t('bronze.optionsCraft')}</legend>
        <Checkbox checked={filters.hasSpatula} onChange={value => setFilter('hasSpatula', value)}>
          <span className={styles.toolLabel}><ItemIcon item={toolItems.spatula} size={20} />{t('bronze.hasSpatula')}</span>
        </Checkbox>
        <Checkbox checked={filters.hasFryingPan} onChange={value => setFilter('hasFryingPan', value)}>
          <span className={styles.toolLabel}><ItemIcon item={toolItems.pan} size={20} />{t('bronze.hasFryingPan')}</span>
        </Checkbox>
      </fieldset>
    </div>
  )
}
