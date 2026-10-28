import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoardStore } from '../../store/boardStore.js'
import UnitCardBody from '../UnitCardBody.jsx'
import UnitStatsSheetLink from '../shared/UnitStatsSheetLink.jsx'
import UnitTopCombos from './UnitTopCombos.jsx'
import UnitTraitChoice from './UnitTraitChoice.jsx'
import styles from './UnitInspector.module.css'

// Team Builder side panel for the clicked board unit (not on phones): the
// hover card's content, a picker for traits chosen in game (Lux, Kha'Zix), its
// 3★ toggle and its most-played item combos. Fixed to the window's right edge,
// with CompBuilderPage moving the page aside while it is open; on tablets a
// sheet along the bottom edge instead.
export default function UnitInspector({ cellId, cell, champion, roster, allItems, onClose }) {
  const { t } = useTranslation()
  const toggleStars = useBoardStore(s => s.toggleStars)
  // Stats are stored under the base unit (Lux forms -> base Lux).
  const statsId = champion.formOf ?? champion.id

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeButton = (
    <button
      type="button"
      className={styles.close}
      onClick={onClose}
      aria-label={t('builder.inspector.close')}
    >
      <span aria-hidden="true">×</span>
    </button>
  )

  return (
    <aside className={styles.panel} aria-label={champion.name} data-no-edge-glow>
      <div className={styles.card}>
        <UnitCardBody champion={champion} headerAction={closeButton}>
          <UnitTraitChoice cellId={cellId} cell={cell} champion={champion} roster={roster} />
        </UnitCardBody>
      </div>

      <button
        type="button"
        className={styles.starToggle}
        aria-pressed={!!cell.stars}
        onClick={() => toggleStars(cellId)}
      >
        <span className={styles.starIcons} aria-hidden="true">★★★</span>
        {t('builder.inspector.threeStar')}
      </button>

      <UnitTopCombos unitId={statsId} cellId={cellId} cellItems={cell.items || []} allItems={allItems} />

      <div className={styles.footer}>
        <UnitStatsSheetLink unitId={statsId} />
      </div>
    </aside>
  )
}
