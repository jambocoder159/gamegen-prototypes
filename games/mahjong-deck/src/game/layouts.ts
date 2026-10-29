// The five stage layouts, each a list of {x, y, z} tile positions on a half-cell
// grid. Every tile has a 2×2 footprint, so a step of 2 places edge-adjacent
// neighbours and a step of 1 a half-offset. Layers are centred over the base so
// every stage reads as a tidy, symmetric pyramid. Tile counts ramp 24 → 64 and
// depth 3 → 4 layers, matching PLAN §3.

import type { Pos } from './logic';

/** A solid rectangle of cols×rows tiles at layer z, top-left footprint at (x0,y0). */
function rect(x0: number, y0: number, cols: number, rows: number, z: number): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 2, y: y0 + r * 2, z });
  }
  return out;
}

export interface Stage {
  index: number; // 0-based
  number: number; // 1-based (display)
  K: number; // number of tile faces used
  positions: Pos[];
}

// Each stage: base layer plus centred upper layers. Widths are in half-cells.
const DEFS: Array<{ K: number; layers: Pos[][] }> = [
  // Stage 1 — 24 tiles, 3 layers (16 + 6 + 2). Base width 8.
  {
    K: 6,
    layers: [
      rect(0, 0, 4, 4, 0), // 16
      rect(1, 2, 3, 2, 1), // 6
      rect(2, 3, 2, 1, 2), // 2
    ],
  },
  // Stage 2 — 36 tiles, 3 layers (20 + 12 + 4). Base width 10.
  {
    K: 8,
    layers: [
      rect(0, 0, 5, 4, 0), // 20
      rect(1, 1, 4, 3, 1), // 12
      rect(1, 3, 4, 1, 2), // 4
    ],
  },
  // Stage 3 — 48 tiles, 4 layers (24 + 12 + 8 + 4). Base width 12.
  {
    K: 10,
    layers: [
      rect(0, 0, 6, 4, 0), // 24
      rect(2, 1, 4, 3, 1), // 12
      rect(2, 2, 4, 2, 2), // 8
      rect(4, 2, 2, 2, 3), // 4
    ],
  },
  // Stage 4 — 60 tiles, 4 layers (28 + 16 + 10 + 6). Base width 14.
  {
    K: 12,
    layers: [
      rect(0, 0, 7, 4, 0), // 28
      rect(3, 0, 4, 4, 1), // 16
      rect(2, 2, 5, 2, 2), // 10
      rect(4, 2, 3, 2, 3), // 6
    ],
  },
  // Stage 5 — 64 tiles, 4 layers (32 + 16 + 10 + 6). Wider, less dense finale.
  {
    K: 14,
    layers: [
      rect(0, 0, 8, 4, 0), // 32
      rect(3, 0, 4, 4, 1), // 16
      rect(2, 2, 5, 2, 2), // 10
      rect(4, 2, 3, 2, 3), // 6
    ],
  },
];

let cache: Stage[] | null = null;

export function getStages(): Stage[] {
  if (!cache) {
    cache = DEFS.map((d, i) => ({
      index: i,
      number: i + 1,
      K: d.K,
      positions: d.layers.flat(),
    }));
  }
  return cache;
}

export const STAGE_COUNT = DEFS.length;

export function getStage(index: number): Stage {
  return getStages()[index];
}
