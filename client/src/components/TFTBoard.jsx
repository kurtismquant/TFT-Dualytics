import { useState, useRef, useEffect, useMemo } from 'react'
import BoardCell from "./BoardCell.jsx";
import EquippedItems from "./EquippedItems.jsx";
import UnitIcon from "./UnitIcon.jsx";
import StarBadge from "./StarBadge.jsx";
import { useUiScale } from "../contexts/useUiScale.js";
import { getEmblemTrait } from "../utils/bronzeComps.js";
import styles from "./TFTBoard.module.css";

const ROWS = 4;
const COLS = 7;
const MAX_HEX_SIZE = 90;

// BOARD_WIDTH = (COLS + 2)*gap + (COLS + 0.5)*hexSize
// Solve for hexSize given available container width (minus 20px padding).
// On mobile we shrink the gap and the min size so all 7 columns fit the
// viewport without horizontal scroll while keeping the hexes as large as
// possible (the per-hex ring is also thinned in DroppableHex.module.css).
// All px constants are Compact-size values, multiplied by the Interface Size
// factor (`scale`) since the board is laid out in JS pixels, not rem.
function calcHexSize(wrapperWidth, gap, minSize, scale) {
  const available = wrapperWidth - 20 * scale;
  const size = (available - (COLS + 2) * gap) / (COLS + 0.5);
  return Math.min(Math.round(MAX_HEX_SIZE * scale), Math.max(minSize, Math.floor(size)));
}

// Does this board unit count toward `trait`: its own traits, picked traits
// (Kha'Zix) or an emblem it holds?
function givesTrait(trait, unit, champion, itemsById) {
  return (champion?.traits || []).includes(trait)
    || (unit.chosenTraits || []).includes(trait)
    || (unit.items || []).some(id => getEmblemTrait(itemsById.get(id)) === trait);
}

// What follows the cursor while a board unit is dragged: its hex with its
// 3★ badge and items, so they move with it instead of waiting in the old hex.
export function BoardUnitDragPreview({ champion, unit, items, size }) {
  return (
    <div className={styles.dragPreview} style={{ width: size, height: size, '--hex-size': `${size}px` }}>
      <UnitIcon champion={champion} variant="hex" />
      {unit.stars && <StarBadge />}
      <EquippedItems itemIds={unit.items} items={items || []} />
    </div>
  );
}

export default function TFTBoard({
  board,
  champions,
  items,
  isMobile = false,
  selectedCellId = null,
  onUnitClick,
  onEmptyHexClick,
  onRemoveUnit,
  onRemoveItem,
  onHexSizeChange,
  draggingCellId = null,
  // Trait hovered in the trait list: its units light up, the rest dim.
  highlightTrait = null,
  // The unit the inspector shows has no hover card (its panel is open).
  inspectedCellId = null,
  overlay = null,
}) {
  const wrapperRef = useRef(null);
  const scale = useUiScale();
  const [hexSize, setHexSize] = useState(MAX_HEX_SIZE);

  const HEX_GAP = Math.round((isMobile ? 5 : 10) * scale);
  const MIN_HEX_SIZE = Math.round((isMobile ? 28 : 38) * scale);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setHexSize(calcHexSize(entry.contentRect.width, HEX_GAP, MIN_HEX_SIZE, scale));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [HEX_GAP, MIN_HEX_SIZE, scale]);

  // Report the live hex size so the drag overlay can match it (otherwise a
  // dragged board unit renders at the fixed desktop size on small screens).
  useEffect(() => {
    onHexSizeChange?.(hexSize);
  }, [hexSize, onHexSizeChange]);

  // E removes the unit under the pointer, like selling in game. Ignored while
  // typing in a field, with modifier keys, on key repeat and mid-drag.
  const hoveredCellRef = useRef(null);
  const onCellHover = (cellId, leftCellId) => {
    if (cellId) hoveredCellRef.current = cellId;
    else if (hoveredCellRef.current === leftCellId) hoveredCellRef.current = null;
  };
  const itemsById = useMemo(() => new Map((items || []).map(item => [item.id, item])), [items]);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "e" && e.key !== "E") return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName)) return;
      const cellId = hoveredCellRef.current;
      if (!cellId || draggingCellId || !board[cellId]?.championId) return;
      e.preventDefault();
      onRemoveUnit?.(cellId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board, draggingCellId, onRemoveUnit]);

  const horizSpacing = hexSize + HEX_GAP;
  const vertSpacing = hexSize * 0.75 + HEX_GAP;
  const rowOffset = horizSpacing / 2;
  const boardWidth = (COLS + 2) * HEX_GAP + (COLS + 0.5) * hexSize;
  const boardHeight = vertSpacing * 3 + hexSize + HEX_GAP * 2;

  return (
    <div
      ref={wrapperRef}
      className={styles.boardWrapper}
      style={{ height: boardHeight + 60 * scale }}
    >
      {overlay}
      <div className={styles.board} style={{ width: boardWidth, height: boardHeight }}>
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const cellId = `cell-${row}-${col}`;
            const left =
              HEX_GAP + col * horizSpacing + (row % 2 === 1 ? rowOffset : 0);
            const top = row * vertSpacing + HEX_GAP;

            const unit = board[cellId];
            const champion = unit
              ? champions?.find((c) => c.id === unit.championId)
              : null;
            const highlight = highlightTrait && champion
              ? (givesTrait(highlightTrait, unit, champion, itemsById) ? "on" : "dim")
              : null;

            return (
              <BoardCell
                key={cellId}
                cellId={cellId}
                unit={unit}
                champion={champion}
                items={items || []}
                size={hexSize}
                style={{
                  left,
                  top,
                  width: hexSize,
                  height: hexSize,
                  // StarBadge sizes its stars from the hex.
                  '--hex-size': `${hexSize}px`,
                }}
                selected={selectedCellId === cellId}
                isDragged={cellId === draggingCellId}
                highlight={highlight}
                hoverCard={cellId !== inspectedCellId}
                onUnitClick={onUnitClick}
                onEmptyHexClick={onEmptyHexClick}
                onRemoveUnit={onRemoveUnit}
                onRemoveItem={onRemoveItem}
                onHover={onCellHover}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
