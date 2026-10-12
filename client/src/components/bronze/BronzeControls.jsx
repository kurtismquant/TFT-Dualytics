import { useTranslation } from 'react-i18next'
import Button from '../ui/Button.jsx'
import EmblemPicker from './EmblemPicker.jsx'
import { BOARD_SIZES } from '../../utils/bronzeComps.js'
import styles from './BronzeComps.module.css'

// Board size (5-10 units) and the emblems the search may count on.
export default function BronzeControls({ size, setSize, emblemIds, setEmblemIds, emblemOptions, itemLookup }) {
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
              pressed={size === option}
              onClick={() => setSize(option)}
              aria-label={t('bronze.sizeOption', { count: option })}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>{t('bronze.emblemsLabel')}</span>
        <EmblemPicker
          emblemIds={emblemIds}
          options={emblemOptions}
          itemLookup={itemLookup}
          onChange={setEmblemIds}
        />
        {emblemIds.length > 0 && (
          <Button variant="ghost" className={styles.clearButton} onClick={() => setEmblemIds([])}>
            {t('bronze.clearEmblems')}
          </Button>
        )}
      </div>
    </div>
  )
}
