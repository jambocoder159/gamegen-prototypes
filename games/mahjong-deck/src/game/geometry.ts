// Shared tile geometry — the SINGLE source of truth for where every tile is
// drawn AND for the cover / side rules. BoardView positions tiles with tileBox();
// the logic's cover and side tests work on the SAME rectangles. So what the
// player sees is exactly what the rules say: a tile reads as covered only where a
// higher tile is actually drawn on top of it, and as side-blocked only where a
// same-layer tile is actually drawn against it.
//
// Each tile is a BT×HT sprite. The sprite art already carries the tile's 3D
// thickness edge, so higher layers are drawn squarely over the grid cell with NO
// extra per-layer pixel offset. With no offset, a half-cell layout step draws an
// upper tile covering a clearly visible quarter/half of the tiles beneath it
// (≥25% area) — never a hard-to-see sliver — and z-index + a drop-shadow give the
// stack its depth.

import type { Pos } from './logic';

export const BT = 72; // tile width (px, pre-scale); the real size comes from the board transform
export const TILE_ASPECT = 182 / 199; // sprite w/h
export const HT = BT / TILE_ASPECT; // tile height (px)

// Per-layer draw offset (px). Kept explicit and shared so the rules can never
// drift from the drawing. Zero → upper tiles sit squarely over lower ones.
export const LAYER_OFF_X = 0;
export const LAYER_OFF_Y = 0;

// A higher tile counts as covering a lower one only when their drawn rectangles
// overlap by at least this fraction of a tile — a visible amount, not a sliver.
export const COVER_MIN_FRAC = 0.12;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The rectangle a tile at {x,y,z} is drawn as, in pre-scale px. */
export function tileBox(p: Pos): Box {
  const left = p.x * (BT / 2) + p.z * LAYER_OFF_X;
  const top = p.y * (HT / 2) + p.z * LAYER_OFF_Y;
  return { left, top, right: left + BT, bottom: top + HT };
}

const TILE_AREA = BT * HT;

function intersectArea(a: Box, b: Box): number {
  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

/** True when `above` (a higher layer) visibly covers `tile` (≥ COVER_MIN_FRAC). */
export function boxCovers(tile: Pos, above: Pos): boolean {
  return intersectArea(tileBox(tile), tileBox(above)) >= COVER_MIN_FRAC * TILE_AREA;
}

/**
 * True when same-layer `other` is drawn touching `tile` on side `dir`
 * (-1 = left, +1 = right): it shares a vertical band with `tile` and its edge
 * meets or overlaps `tile`'s edge on that side.
 */
export function boxSideTouches(tile: Pos, other: Pos, dir: -1 | 1): boolean {
  const a = tileBox(tile);
  const b = tileBox(other);
  const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (vOverlap <= 0) return false; // not in the same row band → doesn't block the side
  const EPS = 0.5; // tolerate exact edge-adjacency
  return dir < 0
    ? b.left < a.left && b.right > a.left - EPS // neighbour pressed against the left edge
    : b.right > a.right && b.left < a.right + EPS; // neighbour pressed against the right edge
}
