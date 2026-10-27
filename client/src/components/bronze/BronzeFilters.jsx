import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ChipPicker from './ChipPicker.jsx'
import Chevron from './Chevron.jsx'
import Segmented from './Segmented.jsx'
import BronzeTuning from './BronzeTuning.jsx'
import ItemIcon from '../ItemIcon.jsx'
import { BOARD_SIZES, MAX_EMBLEMS } from '../../utils/bronzeComps.js'
import { MAX_LISTED_IDS } from '../../utils/bronzeParams.js'
import styles from './BronzeComps.module.css'

// Most units a player's current board can hold ("From my units").
const MAX_BOARD_UNITS = 12

function Field({ id, label, children }) {
  return (
    <div className={styles.field}>
      <span id={id} className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.filterSection}>
      <h3 className={styles.filterSectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

// The filter sidebar: the main inputs (board size, units, emblems), then
// sections of settings that each use one labelled row and the same joined
// toggle buttons. On tablets and phones it collapses behind a "Filters"
// button showing how many filters are on.
// `pickers`: { unit, avoid, emblem } option sets for ChipPicker;
// `choiceUnitNames` / `choiceMax`: trait-choice units (Kha'Zix) in this set.
export default function BronzeFilters({
  filters, setFilter, resetFilters, activeCount, pickers, toolItems, choiceUnitNames = [], choiceMax = 0,
  tuning, setTuning,
}) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const chip = (key, picker, i18nKey, max, extra = {}) => (
    <ChipPicker
      i18nKey={i18nKey}
      selectedIds={filters[key]}
      options={picker.options}
      renderIcon={picker.renderIcon}
      nameFor={picker.nameFor}
      onChange={ids => setFilter(key, ids)}
      max={max}
      className={styles.sidebarPicker}
      {...extra}
    />
  )
  const toggle = (key, item, label) => (
    <button
      type="button"
      className={styles.toolToggle}
      aria-pressed={filters[key]}
      onClick={() => setFilter(key, !filters[key])}
    >
      <ItemIcon item={item} size={20} />
      <span>{label}</span>
    </button>
  )

  return (
    <aside className={styles.sidebar} data-open={open} aria-label={t('bronze.filtersTitle')}>
      <button
        type="button"
        className={styles.filtersToggle}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
      >
        <span>{t('bronze.filtersTitle')}</span>
        {activeCount > 0 && <span className={styles.filtersCount}>{t('bronze.filtersActive', { count: activeCount })}</span>}
        <Chevron direction={open ? 'up' : 'down'} size={16} />
      </button>
      <div id={`${id}-body`} className={styles.filtersBody}>
        <Field id={`${id}-play`} label={t('bronze.playstyleLabel')}>
          <Segmented
            labelledBy={`${id}-play`}
            value={filters.traitLadder}
            onChange={value => setFilter('traitLadder', value)}
            options={[{ value: false, label: t('bronze.playBronze') }, { value: true, label: t('bronze.playLadder') }]}
          />
          <p className={styles.fieldHint}>{t(filters.traitLadder ? 'bronze.playLadderHint' : 'bronze.playBronzeHint')}</p>
        </Field>
                <Field id={`${id}-size`} label={t('bronze.sizeLabel')}>
          <Segmented
            labelledBy={`${id}-size`}
            value={filters.size}
            onChange={value => setFilter('size', value)}
            options={BOARD_SIZES.map(n => ({ value: n, label: n, ariaLabel: t('bronze.sizeOption', { count: n }) }))}
          />
        </Field>
        <Field id={`${id}-units`} label={t(filters.boardMode ? 'bronze.ownedActive' : 'bronze.unitFilterLabel')}>
          {chip('requiredIds', pickers.unit, filters.boardMode ? 'owned' : 'unit', filters.boardMode ? MAX_BOARD_UNITS : filters.size)}
        </Field>
        <Field id={`${id}-avoid`} label={t('bronze.avoidFieldLabel')}>
          {chip('avoidIds', pickers.avoid, 'avoid', MAX_LISTED_IDS)}
        </Field>
        <Field id={`${id}-emblems`} label={t('bronze.emblemsLabel')}>
          {chip('emblemIds', pickers.emblem, 'emblem', MAX_EMBLEMS, { allowDuplicates: true })}
        </Field>

        {/* Only trait-choice units (Kha'Zix) are set here; no section without them. */}
        {choiceUnitNames.length > 0 && choiceMax > 0 && (
          <Section title={t('bronze.sectionUnits')}>
            <Field id={`${id}-choice`} label={t('bronze.choiceTraitsLabel', { units: choiceUnitNames.join(' / ') })}>
              <Segmented
                labelledBy={`${id}-choice`}
                value={Math.min(filters.choiceTraitCount, choiceMax)}
                onChange={value => setFilter('choiceTraitCount', value)}
                options={[
                  { value: 0, label: t('bronze.choiceAny'), ariaLabel: t('bronze.choiceAnyLabel') },
                  ...Array.from({ length: choiceMax }, (_, i) => ({
                    value: i + 1, label: i + 1, ariaLabel: t('bronze.choiceTraitsOption', { count: i + 1 }),
                  })),
                ]}
              />
            </Field>
          </Section>
        )}

        <Section title={t('bronze.sectionItems')}>
          <Field id={`${id}-tools`} label={t('bronze.toolsLabel')}>
            <div className={styles.toolToggles} role="group" aria-labelledby={`${id}-tools`}>
              {toggle('hasSpatula', toolItems.spatula, t('bronze.hasSpatula'))}
              {toggle('hasFryingPan', toolItems.pan, t('bronze.hasFryingPan'))}
            </div>
          </Field>
        </Section>

        <Section title={t('bronze.sectionMode')}>
          <Field id={`${id}-mode`} label={t('bronze.modeLabel')}>
            <Segmented
              labelledBy={`${id}-mode`}
              value={filters.boardMode}
              onChange={value => setFilter('boardMode', value)}
              options={[{ value: false, label: t('bronze.modeBest') }, { value: true, label: t('bronze.modeBoard') }]}
            />
          </Field>
        </Section>

        <details className={styles.tuningDetails}>
          <summary>{t('bronze.tuningTitle')}</summary>
          <BronzeTuning
            filters={{ ...tuning, boardMode: filters.boardMode }}
            setFilter={(key, value) => setTuning(current => ({ ...current, [key]: value }))}
          />
        </details>

        <button type="button" className={styles.resetFilters} onClick={resetFilters} disabled={activeCount === 0}>
          {t('bronze.resetFilters')}
        </button>
      </div>
    </aside>
  )
}
