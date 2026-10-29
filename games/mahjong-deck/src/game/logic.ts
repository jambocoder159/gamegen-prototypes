// Mahjong Deck — pure game logic. No React, no DOM, fully deterministic, so the
// UI, the title bot, the headless test and the node logic test all drive it the
// same way.
//
// Model: a stage is a stack of tiles at half-cell positions {x, y, z}. Each tile
// is a BT×HT sprite spanning a 2×2 half-cell footprint. The cover and side rules
// are computed from the tiles' actual DRAWN rectangles (src/game/geometry.ts) —
// the very same rectangles BoardView renders — so the rules always match the
// picture. A tile is "free" (playable) when no higher tile is drawn visibly over
// it AND at least one of its left/right edges has no same-layer tile against it.
// Two free tiles of the same type can be matched and removed.
//
// Deals are generated reverse-solvable: we repeatedly peel two currently-free
// tiles off the FULL layout and give them the same type. Because peeling two free
// tiles is itself a legal match, the peel order is a guaranteed solution, so the
// finished board is always clearable. Free-tile detection depends only on
// geometry, so the peel order is independent of the types we assign.

import { boxCovers, boxSideTouches } from './geometry';

export interface Pos {
  x: number; // half-cell units, footprint spans [x, x+2)
  y: number; // half-cell units, footprint spans [y, y+2)
  z: number; // layer (0 = bottom)
}

export interface Tile extends Pos {
  id: number;
  type: number; // tile-face id (0..K-1), or -1 before a type is assigned
  removed: boolean;
}

export type PRNG = () => number;

export function mulberry32(seed: number): PRNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when a higher tile is drawn visibly over `tile` (shared geometry). */
function covered(tile: Tile, tiles: Tile[]): boolean {
  for (const o of tiles) {
    if (o.removed || o === tile) continue;
    if (o.z > tile.z && boxCovers(tile, o)) return true;
  }
  return false;
}

/** True when a same-layer tile is drawn against `tile` on side `dir` (-1/+1). */
function sideBlocked(tile: Tile, tiles: Tile[], dir: -1 | 1): boolean {
  for (const o of tiles) {
    if (o.removed || o === tile) continue;
    if (o.z === tile.z && boxSideTouches(tile, o, dir)) return true;
  }
  return false;
}

/** A tile is free when uncovered and at least one horizontal edge is clear. */
export function isFree(tile: Tile, tiles: Tile[]): boolean {
  if (tile.removed) return false;
  if (covered(tile, tiles)) return false;
  return !sideBlocked(tile, tiles, -1) || !sideBlocked(tile, tiles, 1);
}

/**
 * Why a tile can't be played, for the UI's blocked-tap notice: 'covered' when a
 * higher tile sits on it, 'side' when both horizontal edges are blocked, or null
 * when it is actually free. Uses the same geometry as isFree().
 */
export function blockReason(tile: Tile, tiles: Tile[]): 'covered' | 'side' | null {
  if (tile.removed) return null;
  if (covered(tile, tiles)) return 'covered';
  if (sideBlocked(tile, tiles, -1) && sideBlocked(tile, tiles, 1)) return 'side';
  return null;
}

/** All currently-free, non-removed tiles. */
export function freeTiles(tiles: Tile[]): Tile[] {
  return tiles.filter((t) => isFree(t, tiles));
}

export function remaining(tiles: Tile[]): Tile[] {
  return tiles.filter((t) => !t.removed);
}

export function isWon(tiles: Tile[]): boolean {
  return tiles.every((t) => t.removed);
}

/**
 * Peel the stack into an ordered list of free pairs (by tile id). Removes the two
 * highest-layer free tiles each step so covers always go before the covered, which
 * keeps a proper pyramid from ever stranding a vertical stack. Returns null if it
 * ever gets stuck with tiles left but fewer than two free (a malformed layout).
 * Pure: operates on a scratch copy of `removed` flags.
 */
export function peelOrder(positions: Pos[], rng: PRNG): Array<[number, number]> | null {
  const tiles: Tile[] = positions.map((p, id) => ({ ...p, id, type: -1, removed: false }));
  const pairs: Array<[number, number]> = [];
  let left = tiles.length;
  while (left > 0) {
    const free = freeTiles(tiles);
    if (free.length < 2) return null;
    // Highest layers first; break ties with the PRNG for deal variety.
    free.sort((a, b) => b.z - a.z || rng() - 0.5);
    const a = free[0];
    const b = free[1];
    a.removed = true;
    b.removed = true;
    pairs.push([a.id, b.id]);
    left -= 2;
  }
  return pairs;
}

/**
 * Build a solvable deal: assign each peeled pair a type, balanced across K types.
 * Returns the tiles with types set, or null if the layout cannot be peeled.
 */
export function generateDeal(positions: Pos[], K: number, seed: number): Tile[] | null {
  const rng = mulberry32(seed);
  const pairs = peelOrder(positions, rng);
  if (!pairs) return null;
  const tiles: Tile[] = positions.map((p, id) => ({ ...p, id, type: -1, removed: false }));

  // Distribute pairs across the K types as evenly as possible, then shuffle the
  // assignment so equal types aren't clustered in peel order.
  const pairCount = pairs.length;
  const typeForPair: number[] = [];
  for (let i = 0; i < pairCount; i++) typeForPair.push(i % K);
  for (let i = typeForPair.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = typeForPair[i];
    typeForPair[i] = typeForPair[j];
    typeForPair[j] = tmp;
  }
  pairs.forEach(([a, b], i) => {
    tiles[a].type = typeForPair[i];
    tiles[b].type = typeForPair[i];
  });
  return tiles;
}

/**
 * Reassign types to the tiles still on the board (the shuffle card). Keeps every
 * tile's position, re-peels the remaining stack and gives fresh balanced types so
 * the position stays solvable. Mutates `tiles` in place; returns false if the
 * remaining stack cannot be peeled (shouldn't happen from a solvable start).
 */
export function reshuffleTypes(tiles: Tile[], K: number, seed: number): boolean {
  const live = tiles.filter((t) => !t.removed);
  if (live.length === 0) return true;
  const rng = mulberry32(seed);
  const positions: Pos[] = live.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  const pairs = peelOrder(positions, rng);
  if (!pairs) return false;
  const typeForPair: number[] = [];
  for (let i = 0; i < pairs.length; i++) typeForPair.push(i % K);
  for (let i = typeForPair.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = typeForPair[i];
    typeForPair[i] = typeForPair[j];
    typeForPair[j] = tmp;
  }
  pairs.forEach(([a, b], i) => {
    live[a].type = typeForPair[i];
    live[b].type = typeForPair[i];
  });
  return true;
}

/** A matchable pair of free tiles of the same type, or null if none exists. */
export function findMatch(tiles: Tile[]): [number, number] | null {
  const free = freeTiles(tiles);
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (free[i].type === free[j].type) return [free[i].id, free[j].id];
    }
  }
  return null;
}

/** True when at least one same-type free pair exists (wild ignores types). */
export function hasMove(tiles: Tile[], wild = false): boolean {
  if (wild) return freeTiles(tiles).length >= 2;
  return findMatch(tiles) !== null;
}

/** Reproducible stage/redeal seed derived from the saved random run seed. */
export function dealSeed(stageIndex: number, salt: number, seed: number): number {
  return (Math.imul(0x9e3779b1, stageIndex + 1) + Math.imul(salt, 0x85ebca77) + seed) >>> 0;
}
