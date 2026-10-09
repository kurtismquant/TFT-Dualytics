import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ANY_UNIT } from '../../utils/explorerParams.js'
import styles from './DataExplorer.module.css'

function UnitOption({ id, name, iconUrl, count, selected, onPick, onKeyDown }) {
  return (
    <button type="button" className={styles.pickerOption} aria-pressed={selected} onClick={() => onPick(id)} onKeyDown={onKeyDown}>
      {iconUrl ? <img src={iconUrl} alt="" className={styles.pickerIcon} /> : <span className={styles.pickerIcon} />}
      <span className={styles.pickerName}>{name}</span>
      {count != null && <span className={styles.pickerCount}>{count.toLocaleString()}</span>}
    </button>
  )
}

// "Items on" unit chooser with icons (a native <select> can't show them):
// Any unit, then the units in the filters, then every other unit by boards.
// Arrow keys move between options, Escape closes.
export default function ExplorerUnitPicker({ units, filteredIds, selected, onSelect, lookups }) {
  const { t } = useTranslation()
  const menuId = useId()
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)

  const meta = id => lookups.unit.get(id)
  const nameOf = id => meta(id)?.name || id
  const inFilters = units.filter(unit => filteredIds.has(unit.id))
  const others = units.filter(unit => !filteredIds.has(unit.id))

  const pick = id => {
    onSelect(id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (!open) {
      setOpen(true)
      return
    }
    const options = [...(menuRef.current?.querySelectorAll('button') || [])]
    const index = options.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, index + 1) : Math.max(0, index - 1)
    options[next]?.focus()
  }

  const option = unit => (
    <UnitOption
      key={unit.id}
      id={unit.id}
      name={nameOf(unit.id)}
      iconUrl={meta(unit.id)?.iconUrl}
      count={unit.count}
      selected={selected === unit.id}
      onPick={pick}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    <div
      className={styles.picker}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    >
      <span className={styles.controlLabel}>{t('explorer.itemsOn')}</span>
      <button
        ref={buttonRef}
        type="button"
        className={styles.pickerButton}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('explorer.itemsOnLabel', { name: selected === ANY_UNIT ? t('explorer.anyUnit') : nameOf(selected) })}
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleKeyDown}
      >
        {selected !== ANY_UNIT && meta(selected)?.iconUrl && <img src={meta(selected).iconUrl} alt="" className={styles.pickerIcon} />}
        <span className={styles.pickerName}>{selected === ANY_UNIT ? t('explorer.anyUnit') : nameOf(selected)}</span>
        <span className={styles.pickerCaret} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={menuId} ref={menuRef} className={styles.pickerMenu} role="group" aria-label={t('explorer.itemsOn')}>
          <UnitOption id={ANY_UNIT} name={t('explorer.anyUnit')} selected={selected === ANY_UNIT} onPick={pick} onKeyDown={handleKeyDown} />
          {inFilters.length > 0 && <p className={styles.pickerHeading}>{t('explorer.unitPicker.inFilters')}</p>}
          {inFilters.map(option)}
          {others.length > 0 && <p className={styles.pickerHeading}>{t('explorer.unitPicker.allUnits')}</p>}
          {others.map(option)}
        </div>
      )}
    </div>
  )
}
