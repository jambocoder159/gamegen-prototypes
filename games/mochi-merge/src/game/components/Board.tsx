// The board frame (panel_board) with 16 cell slots (panel_cell) positioned from
// the measured inner field, and the live tiles on top. Handles swipe gestures
// when interactive; keyboard is handled by the owning screen.
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_IMG_W, BOARD_IMG_H, CELLS } from '../../config/layout';
import { renderTiles, type Dir, type GameState } from '../logic';
import { Art } from './Art';
import { TileView } from './TileView';

const MIN_SWIPE = 24; // px

export function Board({
  state,
  reduced,
  interactive,
  onMove,
  ariaLabel,
}: {
  state: GameState;
  reduced: boolean;
  interactive: boolean;
  onMove?: (dir: Dir) => void;
  ariaLabel?: string;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const tiles = renderTiles(state);

  const onDown = (e: ReactPointerEvent) => {
    if (!interactive) return;
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onUp = (e: ReactPointerEvent) => {
    if (!interactive || !start.current || !onMove) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    // ignore tiny / mostly-diagonal drags
    if (Math.max(ax, ay) < MIN_SWIPE) return;
    if (ax > ay) onMove(dx > 0 ? 'right' : 'left');
    else onMove(dy > 0 ? 'down' : 'up');
  };

  return (
    <div
      className={`board${reduced ? ' board--reduced' : ''}`}
      style={{ aspectRatio: `${BOARD_IMG_W} / ${BOARD_IMG_H}` }}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => (start.current = null)}
    >
      <Art imgKey="board" alt="" className="board__frame" />
      <div className="board__cells" aria-hidden>
        {CELLS.map((c) => (
          <div
            key={`${c.row}-${c.col}`}
            className="cell"
            style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.w}%`, height: `${c.h}%` }}
          >
            <Art imgKey="cell" alt="" className="cell__img" />
          </div>
        ))}
      </div>
      <div className="board__tiles" aria-hidden>
        {tiles.map((t) => (
          <TileView key={t.id} tile={t} />
        ))}
      </div>
    </div>
  );
}
