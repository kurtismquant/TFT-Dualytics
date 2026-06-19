import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import DraggableItem from './DraggableItem.jsx'
import ItemCard from './ItemCard.jsx'
import styles from './ItemPicker.module.css'
import { useHoverCard } from '../hooks/useHoverCard.js'

function PickerItem({ item, allItems, onSelect, selected }) {
  const { onMouseEnter, onMouseLeave, cardProps } = useHoverCard(item)
  return (
    <>
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <DraggableItem
          id={`item-${item.id}`}
          item={item}
          size={42}
          onClick={onSelect ? () => onSelect(item.id) : undefined}
          selected={selected}
        />
      </div>
      {cardProps.isOpen && createPortal(
        <ItemCard {...cardProps} allItems={allItems} />,
        document.body
      )}
    </>
  )
}

export default function ItemPicker({ items, search = '', category = 'craftable', onSelect, selectedItemId }) {
  const { t } = useTranslation()
  const normalizedSearch = search.trim().toLowerCase()

  const visible = (items || [])
    .filter(it => (it.category || 'other') === category)
    .filter(it => !normalizedSearch || it.name?.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.picker}>
      {visible.length === 0 ? (
        <p className={styles.empty} role="status">{t('itemPicker.empty')}</p>
      ) : (
        <div className={styles.grid}>
          {visible.map(item => (
            <PickerItem
              key={item.id}
              item={item}
              allItems={items}
              onSelect={onSelect}
              selected={selectedItemId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
