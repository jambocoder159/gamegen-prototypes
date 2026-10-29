// Shelf geometry + how many columns to use at a given container size.
//
// panel_shelf.png is 971×231. Its usable cream field spans the full width; the
// orange board's top edge — where goods rest their bottom — sits at ~84% of the
// shelf height (both measured by an alpha/colour scan of the PNG).

export const SHELF_IMG_W = 971;
export const SHELF_IMG_H = 231;
export const SHELF_ASPECT = SHELF_IMG_W / SHELF_IMG_H; // ~4.203

/** Fractions of the shelf image used to place goods inside a slot. */
export const SHELF = {
  padX: 0.02, // cream field inset on each side
  boardTop: 0.84, // goods baseline (top edge of the orange board)
  slotTop: 0.1, // highest a goods may rise to
} as const;

export const MIN_SLOT = 44; // px touch target (WCAG)

export interface BoardLayout {
  cols: number;
  rows: number;
  shelfW: number; // px
  shelfH: number; // px
  gap: number; // px, between shelves (both axes)
}

/**
 * Choose a column count (1..maxCols) and shelf size that fit `n` shelves into an
 * availW×availH box, maximising shelf size while keeping each slot ≥ MIN_SLOT px
 * wherever possible. Layouts that meet the touch-target minimum always beat ones
 * that don't; among equals, the bigger shelf (then fewer columns) wins — which
 * keeps portrait as a single column until the shelves would get too small.
 */
export function computeBoardLayout(
  n: number,
  availW: number,
  availH: number,
  maxCols: number,
  gap = 8,
  maxShelfW = 520,
): BoardLayout {
  let best: BoardLayout | null = null;
  let bestScore = -Infinity;
  const cap = Math.max(1, Math.min(maxCols, n));
  for (let cols = 1; cols <= cap; cols++) {
    const rows = Math.ceil(n / cols);
    const wLimit = (availW - (cols - 1) * gap) / cols;
    const hLimit = (availH - (rows - 1) * gap) / rows; // per-shelf height budget
    const shelfW = Math.max(0, Math.min(wLimit, hLimit * SHELF_ASPECT, maxShelfW));
    const shelfH = shelfW / SHELF_ASPECT;
    const slotMin = Math.min(shelfW / 3, shelfH); // smaller side of a slot button
    const meets = slotMin >= MIN_SLOT ? 1 : 0;
    const score = meets * 1e7 + shelfW * 100 - cols;
    if (score > bestScore) {
      bestScore = score;
      best = { cols, rows, shelfW, shelfH, gap };
    }
  }
  return best as BoardLayout;
}
