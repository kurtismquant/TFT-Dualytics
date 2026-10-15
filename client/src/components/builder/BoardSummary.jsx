import { useTranslation } from 'react-i18next'
import { formatAvg } from '../../utils/statsFormatting.js'
import { getAvgPlacementColor } from '../../utils/statsQuality.js'
import styles from '../../pages/CompBuilderPage.module.css'

// One line under the title: unit count and total cost, then how many boards
// this patch ran all of these units and how they placed (`partners`, the
// /explorer/partners answer the gold names already fetch).
export default function BoardSummary({ board, champions, partners }) {
  const { t } = useTranslation()
  const placed = Object.values(board).filter(cell => cell?.championId)
  if (!placed.length) return null
  const byId = new Map((champions || []).map(c => [c.id, c]))
  const cost = placed.reduce((sum, cell) => sum + (byId.get(cell.championId)?.cost || 0), 0)

  let stats = null
  if (partners?.ready && partners.boards > 0) {
    stats = (
      <>
        <span>{t('builder.summary.boards', { count: partners.boards, formatted: partners.boards.toLocaleString() })}</span>
        <span>
          <span className={styles.summaryAvg} style={{ color: getAvgPlacementColor(partners.avgPlacement) }}>
            {formatAvg(partners.avgPlacement)}
          </span>
          {' '}{t('builder.summary.avg')}
        </span>
      </>
    )
  } else if (partners?.ready) {
    stats = <span>{t('builder.summary.none')}</span>
  }

  return (
    <p className={styles.summary}>
      <span>{t('builder.summary.units', { count: placed.length })}</span>
      <span>{t('builder.summary.cost', { cost })}</span>
      {stats}
    </p>
  )
}
