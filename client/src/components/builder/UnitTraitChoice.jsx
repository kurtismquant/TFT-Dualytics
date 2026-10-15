import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoardStore } from '../../store/boardStore.js'
import { useTraits } from '../../hooks/useTraits.js'
import { TRAIT_CHOICE_UNITS } from '../../utils/bronzeComps.js'
import TraitPicker from './TraitPicker.jsx'

// The inspector's picker for units whose traits are chosen in game:
//  - Lux: one form. Picking swaps the cell's unit for that form ("Blossom Lux"),
//    which counts twice toward its trait (traitWeights, utils/builderRoster.js).
//  - Kha'Zix: any of his evolutions, each +1 (cell.chosenTraits, boardStore).
// Renders nothing for other units.
export default function UnitTraitChoice({ cellId, cell, champion, roster }) {
  const { t } = useTranslation()
  const setCellChampion = useBoardStore(s => s.setCellChampion)
  const setChosenTraits = useBoardStore(s => s.setChosenTraits)
  const { data: traits } = useTraits()
  const traitByName = useMemo(() => new Map((traits || []).map(trait => [trait.name, trait])), [traits])

  const baseId = champion.pickForm ? champion.id : champion.formOf
  const forms = useMemo(
    () => (baseId ? roster.filter(c => c.formOf === baseId) : []),
    [roster, baseId],
  )
  const choice = TRAIT_CHOICE_UNITS[champion.id]

  if (forms.length) {
    const options = forms.map(form => {
      const trait = Object.keys(form.traitWeights || {})[0] ?? form.name
      return { value: form.id, trait, label: trait }
    })
    return (
      <TraitPicker
        key={cellId}
        label={t('builder.inspector.luxTraitLabel')}
        placeholder={t('builder.inspector.luxTraitPlaceholder')}
        options={options}
        selected={champion.formOf ? [champion.id] : []}
        onToggle={formId => setCellChampion(cellId, formId)}
        traitByName={traitByName}
      />
    )
  }

  if (choice) {
    const selected = cell.chosenTraits || []
    return (
      <TraitPicker
        key={cellId}
        multiple
        label={t('builder.inspector.evolutionsLabel')}
        placeholder={t('builder.inspector.evolutionsPlaceholder')}
        options={choice.from.map(trait => ({ value: trait, trait, label: trait }))}
        selected={selected}
        onToggle={trait => setChosenTraits(
          cellId,
          selected.includes(trait) ? selected.filter(x => x !== trait) : [...selected, trait],
        )}
        traitByName={traitByName}
      />
    )
  }

  return null
}
