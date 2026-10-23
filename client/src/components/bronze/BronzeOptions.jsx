import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import ItemIcon from '../ItemIcon.jsx'
import BronzeTuning from './BronzeTuning.jsx'
import styles from './BronzeComps.module.css'

function Checkbox({ checked, onChange, children }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

// The "more options" panel: every checkbox and setting, in three groups.
// `choiceUnitNames`: trait-choice units in this set (Kha'Zix); none hides
// their options. `choiceMax`: most traits such a unit picks from; the 1..max
// buttons under "Exclude ..." choose how many it has.
export default function BronzeOptions({ id, filters, setFilter, toolItems, choiceUnitNames = [], choiceMax = 0 }) {
  const { t } = useTranslation()
  const choiceUnits = choiceUnitNames.join(' / ')
  const choiceLabelId = useId()
  const choiceValue = Math.min(filters.choiceTraitCount, choiceMax)
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
          <div className={styles.subOption}>
            <span id={choiceLabelId}>{t('bronze.choiceTraitsLabel', { units: choiceUnits })}</span>
            <div className={styles.segmented} role="group" aria-labelledby={choiceLabelId}>
              {Array.from({ length: choiceMax }, (_, i) => i + 1).map(n => (
                <Button
                  key={n}
                  variant="tab"
                  className={styles.segmentButton}
                  pressed={choiceValue === n}
                  onClick={() => setFilter('choiceTraitCount', n)}
                  aria-label={t('bronze.choiceTraitsOption', { count: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
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
      <BronzeTuning filters={filters} setFilter={setFilter} />
    </div>
  )
}
