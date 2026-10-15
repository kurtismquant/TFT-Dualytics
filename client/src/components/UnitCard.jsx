import DetailCardShell from './shared/DetailCardShell.jsx'
import UnitStatsSheetLink from './shared/UnitStatsSheetLink.jsx'
import UnitCardBody from './UnitCardBody.jsx'
import styles from './UnitCard.module.css'

export default function UnitCard({ isOpen, data: champion, style, mode, onClose }) {
  if (!isOpen || !champion) return null

  return (
    <DetailCardShell
      mode={mode}
      style={style}
      onClose={onClose}
      cardClassName={styles.card}
      label={champion.name}
      sheetFooter={<UnitStatsSheetLink unitId={champion.id} onNavigate={onClose} />}
    >
      <UnitCardBody champion={champion} />
    </DetailCardShell>
  )
}
