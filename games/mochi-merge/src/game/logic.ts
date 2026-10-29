// Mochi Merge — pure game logic. No React, no DOM, fully deterministic given a
// seed, so the headless test and the title bot can drive it the same way the UI
// does. Model follows the classic slide-and-merge approach but tracks stable
// tile ids + previous positions so the renderer can reuse DOM nodes and animate.

export type Dir = 'up' | 'down' | 'left' | 'right';

export const GRID = 4;
export const WIN_TIER = 9; // dragon mochi

export interface Tile {
  id: number;
  tier: number;
  row: number;
  col: number;
  // Transient, for the current frame only:
  prevRow: number; // where it slid from (== row for tiles that didn't move)
  prevCol: number;
  isNew: boolean; // spawned this move → spawn pop
  merged: boolean; // produced by a merge this move → merge pop
}

export interface GameState {
  grid: (Tile | null)[][]; // GRID x GRID
  ghosts: Tile[]; // tiles absorbed by a merge, kept one frame to slide out
  score: number;
  over: boolean;
  won: boolean; // has ever reached WIN_TIER
  keepGoing: boolean; // player dismissed the win banner to keep playing
  seed: number; // RNG state (mutated via next())
  nextId: number;
  moves: number; // completed board-changing moves, persisted with the run
}

export interface MoveResult {
  state: GameState;
  changed: boolean; // board changed → caller should treat as a real move
  merged: boolean; // at least one merge happened → merge sfx
  mergedTier: number; // highest tier produced by a merge this move (0 if none)
  reachedWin: boolean; // first time WIN_TIER appeared this move → win banner
}

// --- seedable RNG (mulberry32) ---------------------------------------------
function nextRand(state: GameState): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Score awarded when a merge produces a tile of `tier`: 2^tier (4,8,…,512). */
export function mergeValue(tier: number): number {
  return 2 ** tier;
}

const VECTORS: Record<Dir, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

function emptyGrid(): (Tile | null)[][] {
  return Array.from({ length: GRID }, () => Array<Tile | null>(GRID).fill(null));
}

function emptyCells(grid: (Tile | null)[][]): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) if (!grid[r][c]) out.push({ row: r, col: c });
  return out;
}

/** Spawn one tile (tier 1 at 90%, tier 2 at 10%) in a random empty cell. */
function spawn(state: GameState): void {
  const cells = emptyCells(state.grid);
  if (cells.length === 0) return;
  const pick = cells[Math.floor(nextRand(state) * cells.length)];
  const tier = nextRand(state) < 0.1 ? 2 : 1;
  const tile: Tile = {
    id: state.nextId++,
    tier,
    row: pick.row,
    col: pick.col,
    prevRow: pick.row,
    prevCol: pick.col,
    isNew: true,
    merged: false,
  };
  state.grid[pick.row][pick.col] = tile;
}

function traversals(dir: Dir): { rows: number[]; cols: number[] } {
  const rows = [0, 1, 2, 3];
  const cols = [0, 1, 2, 3];
  if (dir === 'down') rows.reverse();
  if (dir === 'right') cols.reverse();
  return { rows, cols };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < GRID && c >= 0 && c < GRID;
}

/**
 * Core slide + merge over `grid` (mutated). Resets per-frame flags first.
 * Returns what happened; does NOT spawn or change over/won.
 */
function slide(state: GameState, grid: (Tile | null)[][], dir: Dir) {
  const ghosts: Tile[] = [];
  let changed = false;
  let mergedAny = false;
  let topTier = 0;

  // reset transient flags / record previous positions
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const t = grid[r][c];
      if (t) {
        t.prevRow = t.row;
        t.prevCol = t.col;
        t.isNew = false;
        t.merged = false;
      }
    }

  const { dr, dc } = VECTORS[dir];
  const { rows, cols } = traversals(dir);
  for (const r of rows)
    for (const c of cols) {
      const tile = grid[r][c];
      if (!tile) continue;
      // walk as far as possible in the direction
      let nr = r;
      let nc = c;
      while (true) {
        const tr = nr + dr;
        const tc = nc + dc;
        if (!inBounds(tr, tc)) break;
        const occupant = grid[tr][tc];
        if (!occupant) {
          nr = tr;
          nc = tc;
          continue;
        }
        // blocked: merge if equal tier and that tile hasn't merged yet
        if (occupant.tier === tile.tier && !occupant.merged) {
          grid[r][c] = null;
          tile.row = tr; // slides into the occupant's cell, then vanishes
          tile.col = tc;
          ghosts.push(tile);
          occupant.tier += 1;
          occupant.merged = true;
          state.score += mergeValue(occupant.tier);
          mergedAny = true;
          changed = true;
          topTier = Math.max(topTier, occupant.tier);
        }
        break;
      }
      // no merge happened for this tile → move to farthest empty cell
      if (grid[r][c] === tile && (nr !== r || nc !== c)) {
        grid[r][c] = null;
        tile.row = nr;
        tile.col = nc;
        grid[nr][nc] = tile;
        changed = true;
      }
    }

  return { ghosts, changed, mergedAny, topTier };
}

// --- public API ------------------------------------------------------------

export function newGame(seed: number): GameState {
  const state: GameState = {
    grid: emptyGrid(),
    ghosts: [],
    score: 0,
    over: false,
    won: false,
    keepGoing: false,
    seed: seed >>> 0,
    nextId: 1,
    moves: 0,
  };
  spawn(state);
  spawn(state);
  return state;
}

/** Can the board still change with any of the four moves? */
export function hasMoves(grid: (Tile | null)[][]): boolean {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const t = grid[r][c];
      if (!t) return true;
      if (r + 1 < GRID && grid[r + 1][c]?.tier === t.tier) return true;
      if (c + 1 < GRID && grid[r][c + 1]?.tier === t.tier) return true;
    }
  return false;
}

/**
 * Apply a move. Returns a NEW state (fresh tile objects) so React re-renders.
 * Spawns a tile and recomputes game-over only when the board actually changed.
 */
export function move(prev: GameState, dir: Dir): MoveResult {
  const state = cloneState(prev);
  state.ghosts = [];
  const { ghosts, changed, mergedAny, topTier } = slide(state, state.grid, dir);
  let reachedWin = false;
  if (changed) {
    state.moves += 1;
    state.ghosts = ghosts;
    if (!state.won && topTier >= WIN_TIER) {
      state.won = true;
      reachedWin = true;
    }
    spawn(state);
    state.over = !hasMoves(state.grid);
  }
  return { state, changed, merged: mergedAny, mergedTier: mergedAny ? topTier : 0, reachedWin };
}

/** Lightweight look-ahead for the bot: does `dir` change the board, and how good is it? */
export function evaluate(
  state: GameState,
  dir: Dir,
): { changed: boolean; merges: number; empties: number } {
  const probe = cloneState(state);
  const before = countTiles(state.grid);
  const { changed, mergedAny } = slide(probe, probe.grid, dir);
  const after = countTiles(probe.grid);
  // each merge removes one tile; merges = before - after (when changed)
  const merges = mergedAny ? before - after : 0;
  const empties = GRID * GRID - after;
  return { changed, merges, empties };
}

function countTiles(grid: (Tile | null)[][]): number {
  let n = 0;
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (grid[r][c]) n++;
  return n;
}

export function cloneState(s: GameState): GameState {
  const grid = emptyGrid();
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const t = s.grid[r][c];
      if (t) grid[r][c] = { ...t };
    }
  return {
    grid,
    ghosts: s.ghosts.map((g) => ({ ...g })),
    score: s.score,
    over: s.over,
    won: s.won,
    keepGoing: s.keepGoing,
    seed: s.seed,
    nextId: s.nextId,
    moves: s.moves,
  };
}

/** Flat render list (ghosts first so merge results pop on top), stable by id. */
export function renderTiles(state: GameState): Tile[] {
  const out: Tile[] = [...state.ghosts];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const t = state.grid[r][c];
      if (t) out.push(t);
    }
  return out;
}

/** Merges only increase tiers, so this is also the highest tier reached in the run. */
export function highestTier(state: GameState): number {
  return Math.max(1, ...state.grid.flat().map(tile => tile?.tier ?? 0));
}
