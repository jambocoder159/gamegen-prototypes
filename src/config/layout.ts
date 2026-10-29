// Board geometry.
//
// The 4x4 play field must sit exactly inside the flat inner area of
// panel_board.png. That inner area was measured programmatically by an
// alpha/colour scan (see scripts/measure-board.py) rather than guessed:
//
//   panel_board.png : 758 x 779 px
//   flat inner field: x0=87 y0=98  x1=671 y1=693  (584 x 595 px)
//   as fractions    : x0=0.1148 y0=0.1258  x1=0.8852 y1=0.8896
//
// panel_cell.png's own flat inset (for reference) is ~7.7% on every side.

export const BOARD_IMG_W = 758;
export const BOARD_IMG_H = 779;
export const BOARD_ASPECT = BOARD_IMG_W / BOARD_IMG_H; // ~0.9731

/** Measured flat inner field of panel_board.png, as fractions of the image. */
export const FIELD = { x0: 0.1148, y0: 0.1258, x1: 0.8852, y1: 0.8896 } as const;

export const GRID = 4;
/** Gap between (and around) cells, as a fraction of the square field side. */
export const GAP_RATIO = 0.05;

export interface Rect {
  left: number;
  top: number;
  size: number;
}

/**
 * Pixel rects for the 16 cells (and tiles) given the rendered board box size.
 * A square grid is centred inside the measured inner field, with equal gaps on
 * every side and between cells.
 */
export interface CellPct {
  row: number;
  col: number;
  left: number; // % of board width
  top: number; // % of board height
  w: number; // % of board width
  h: number; // % of board height
}

/**
 * Cell rects as percentages of the board box. Because the board box keeps the
 * image's aspect ratio, these percentages render as exact squares regardless of
 * the board's pixel size — so no runtime measuring is needed for layout.
 */
export const CELLS: CellPct[] = (() => {
  const g = cellGeometry(BOARD_IMG_W, BOARD_IMG_H);
  const out: CellPct[] = [];
  for (let row = 0; row < GRID; row++)
    for (let col = 0; col < GRID; col++) {
      const r = g.at(row, col);
      out.push({
        row,
        col,
        left: (r.left / BOARD_IMG_W) * 100,
        top: (r.top / BOARD_IMG_H) * 100,
        w: (r.size / BOARD_IMG_W) * 100,
        h: (r.size / BOARD_IMG_H) * 100,
      });
    }
  return out;
})();

export function cellPct(row: number, col: number): CellPct {
  return CELLS[row * GRID + col];
}

export function cellGeometry(boardW: number, boardH: number) {
  const fx0 = FIELD.x0 * boardW;
  const fy0 = FIELD.y0 * boardH;
  const fw = (FIELD.x1 - FIELD.x0) * boardW;
  const fh = (FIELD.y1 - FIELD.y0) * boardH;
  const side = Math.min(fw, fh);
  const ox = fx0 + (fw - side) / 2;
  const oy = fy0 + (fh - side) / 2;
  const gap = side * GAP_RATIO;
  const cell = (side - (GRID + 1) * gap) / GRID;
  const at = (row: number, col: number): Rect => ({
    left: ox + gap + col * (cell + gap),
    top: oy + gap + row * (cell + gap),
    size: cell,
  });
  return { ox, oy, side, gap, cell, at };
}
