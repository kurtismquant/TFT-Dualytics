import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import ChipPicker from './ChipPicker.jsx'
import { BOARD_SIZES, MAX_EMBLEMS } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

function Checkbox({ checked, onChange, children }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

// Board size, counting options, required units and the emblems the search
// may count on.
export default function BronzeControls({ filters, setFilter, emblemPicker, unitPicker }) {
  const { t } = useTranslation()
  return (
    <div className={styles.controls}>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel} id="bronze-size-label">{t('bronze.sizeLabel')}</span>
        <div className={styles.sizeGroup} role="group" aria-labelledby="bronze-size-label">
          {BOARD_SIZES.map(option => (
            <Button
              key={option}
              variant="tab"
              className={styles.sizeButton}
              pressed={filters.size === option}
              onClick={() => setFilter('size', option)}
              aria-label={t('bronze.sizeOption', { count: option })}
            >
              {option}
            </Button>
          ))}
        </div>
        <div className={styles.checkboxes}>
          <Checkbox checked={filters.includeSilverGold} onChange={value => setFilter('includeSilverGold', value)}>
            {t('bronze.includeSilverGold')}
          </Checkbox>
          <Checkbox checked={filters.excludeLegendary} onChange={value => setFilter('excludeLegendary', value)}>
            {t('bronze.excludeLegendary')}
          </Checkbox>
          <Checkbox checked={filters.excludeKhaZix} onChange={value => setFilter('excludeKhaZix', value)}>
            {t('bronze.excludeKhaZix')}
          </Checkbox>
        </div>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>{t('bronze.unitFilterLabel')}</span>
        <ChipPicker
          i18nKey="unit"
          selectedIds={filters.requiredIds}
          options={unitPicker.options}
          renderIcon={unitPicker.renderIcon}
          nameFor={unitPicker.nameFor}
          onChange={ids => setFilter('requiredIds', ids)}
          max={filters.size}
        />
        {filters.requiredIds.length > 0 && (
          <Button variant="ghost" className={styles.clearButton} onClick={() => setFilter('requiredIds', [])}>
            {t('bronze.clear')}
          </Button>
        )}
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>{t('bronze.emblemsLabel')}</span>
        <ChipPicker
          i18nKey="emblem"
          selectedIds={filters.emblemIds}
          options={emblemPicker.options}
          renderIcon={emblemPicker.renderIcon}
          nameFor={emblemPicker.nameFor}
          onChange={ids => setFilter('emblemIds', ids)}
          max={MAX_EMBLEMS}
          allowDuplicates
        />
        {filters.emblemIds.length > 0 && (
          <Button variant="ghost" className={styles.clearButton} onClick={() => setFilter('emblemIds', [])}>
            {t('bronze.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
