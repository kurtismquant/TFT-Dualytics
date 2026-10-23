import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { BOARD_MAX_SWAPS, BOARD_WEIGHTS } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

const COSTS = [1, 2, 3, 4, 5]

function Slider({ label, value, min, max, step, onChange, format = v => v }) {
  const id = useId()
  return (
    <div className={styles.slider}>
      <label htmlFor={id} className={styles.sliderLabel}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      <output htmlFor={id} className={styles.sliderValue}>{format(value)}</output>
    </div>
  )
}

// Testing aid: sliders for the Build-from-my-units scoring (BOARD_WEIGHTS)
// and the swap cap, live. Only that mode uses them.
export default function BronzeTuning({ filters, setFilter }) {
  const { t } = useTranslation()
  const weights = filters.boardWeights
  const setWeight = (key, value) => setFilter('boardWeights', { ...weights, [key]: value })
  const setMissing = (cost, value) => setFilter('boardWeights', { ...weights, missing: { ...weights.missing, [cost]: value } })
  const reset = () => {
    setFilter('boardWeights', BOARD_WEIGHTS)
    setFilter('maxSwaps', BOARD_MAX_SWAPS)
  }
  return (
    <fieldset className={`${styles.optionGroup} ${filters.boardMode ? '' : styles.tuningIdle}`}>
      <legend className={styles.optionLegend}>{t('bronze.tuningTitle')}</legend>
      {!filters.boardMode && <p className={styles.tuningHint}>{t('bronze.tuningHint')}</p>}
      <Slider label={t('bronze.tuningTrait')} value={weights.trait} min={0} max={5} step={0.25} onChange={v => setWeight('trait', v)} />
      <Slider label={t('bronze.tuningShared')} value={weights.sharedTrait} min={0} max={5} step={0.25} onChange={v => setWeight('sharedTrait', v)} />
      {COSTS.map(cost => (
        <Slider
          key={cost}
          label={t('bronze.tuningMissing', { cost })}
          value={weights.missing[cost]}
          min={0}
          max={5}
          step={0.25}
          onChange={v => setMissing(cost, v)}
        />
      ))}
      <Slider
        label={t('bronze.tuningSwaps')}
        value={filters.maxSwaps ?? 6}
        min={0}
        max={6}
        step={1}
        onChange={v => setFilter('maxSwaps', v === 6 ? null : v)}
        format={v => (v === 6 ? t('bronze.tuningNoCap') : v)}
      />
      <button type="button" className={styles.tuningReset} onClick={reset}>{t('bronze.tuningReset')}</button>
    </fieldset>
  )
}
