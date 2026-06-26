import { useDroppable } from '@dnd-kit/core';
import styles from './DroppableHex.module.css';

export default function DroppableHex({ cellId, children, size, onClick, selected = false }) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });

  // For a perfect hexagon, the height should be ~1.1547 times the width
  // (or width is 0.866 of height). Adjusting based on your 'size' prop:
  const hexStyle = {
    width: size,
    height: `calc(${size} * 1.1547)`,
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.hex} ${isOver ? styles.over : ''} ${selected ? styles.selected : ''}`}
      style={hexStyle}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.(e)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <div className={styles.hexFill} />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}