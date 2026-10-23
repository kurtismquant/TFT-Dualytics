import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import ChipPicker from './ChipPicker.jsx'
import Chevron from './Chevron.jsx'
import BronzeOptions from './BronzeOptions.jsx'
import { BOARD_SIZES, MAX_EMBLEMS } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

// Most units a player's current board can hold (recommended-boards mode).
const MAX_BOARD_UNITS = 10

// Board size, required units (or, in recommended-boards mode, the player's
// units) and the emblems the search may count on; a "more options" toggle
// under them opens every checkbox and dropdown (BronzeOptions).
export default function BronzeControls({
  filters, setFilter, emblemPicker, unitPicker, toolItems, choiceUnitNames = [], choiceMax = 0,
}) {
  const { t } = useTranslation()
  const optionsId = useId()
  const [optionsOpen, setOptionsOpen] = useState(false)
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
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>{t('bronze.unitFilterLabel')}</span>
        <ChipPicker
          i18nKey={filters.boardMode ? 'owned' : 'unit'}
          selectedIds={filters.requiredIds}
          options={unitPicker.options}
          renderIcon={unitPicker.renderIcon}
          nameFor={unitPicker.nameFor}
          onChange={ids => setFilter('requiredIds', ids)}
          max={filters.boardMode ? MAX_BOARD_UNITS : filters.size}
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
      <button
        type="button"
        className={styles.moreToggle}
        onClick={() => setOptionsOpen(open => !open)}
        aria-expanded={optionsOpen}
        aria-controls={optionsId}
      >
        <span>{t(optionsOpen ? 'bronze.fewerOptions' : 'bronze.moreOptions')}</span>
        <Chevron direction={optionsOpen ? 'up' : 'down'} size={14} />
      </button>
      {optionsOpen && (
        <BronzeOptions
          id={optionsId}
          filters={filters}
          setFilter={setFilter}
          toolItems={toolItems}
          choiceUnitNames={choiceUnitNames}
          choiceMax={choiceMax}
        />
      )}
    </div>
  )
}
