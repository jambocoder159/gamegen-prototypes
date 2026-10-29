// Only stable move state is stored; animation ghosts never survive a reload.
import { hasMoves, highestTier, WIN_TIER, type GameState, type Tile } from './logic';

export const RUN_KEY = 'mochi.run';
const MAX_BYTES = 12000;
export interface SavedRun { version: 1; state: GameState; best: number; newBest: boolean }
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function clearRun(): void {
  try { localStorage.removeItem(RUN_KEY); } catch { /* storage may be unavailable */ }
}

export function readRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    if (raw.length > MAX_BYTES) throw new Error('size');
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 1 || !integer(data.best) || typeof data.newBest !== 'boolean' || !record(data.state)) throw new Error('envelope');
    const s = data.state;
    if (!integer(s.score) || data.best < s.score || !integer(s.seed, 0, 0xffffffff) || !integer(s.nextId, 1) || !integer(s.moves) || s.over !== false || typeof s.won !== 'boolean' || typeof s.keepGoing !== 'boolean') throw new Error('state');
    if (!Array.isArray(s.grid) || s.grid.length !== 4) throw new Error('grid');
    const ids = new Set<number>();
    const grid: GameState['grid'] = s.grid.map((row: unknown, r: number) => {
      if (!Array.isArray(row) || row.length !== 4) throw new Error('row');
      return row.map((v: unknown, c: number): Tile | null => {
        if (v === null) return null;
        if (!record(v) || !integer(v.id, 1) || v.id >= (s.nextId as number) || ids.has(v.id) || !integer(v.tier, 1, 40) || v.row !== r || v.col !== c) throw new Error('tile');
        ids.add(v.id);
        return { id: v.id, tier: v.tier, row: r, col: c, prevRow: r, prevCol: c, isNew: false, merged: false };
      });
    });
    const state: GameState = { grid, ghosts: [], score: s.score, over: false, won: s.won, keepGoing: s.keepGoing, seed: s.seed, nextId: s.nextId, moves: s.moves };
    if (ids.size < 2 || !hasMoves(grid) || state.won !== (highestTier(state) >= WIN_TIER) || (state.won && !state.keepGoing) || (!state.won && state.keepGoing)) throw new Error('run flags');
    return { version: 1, state, best: data.best, newBest: data.newBest };
  } catch {
    clearRun();
    return null;
  }
}

export function saveRun(state: GameState, best: number, newBest: boolean): void {
  if (state.over || (state.won && !state.keepGoing)) { clearRun(); return; }
  try {
    const stable = { ...state, ghosts: [], grid: state.grid.map(row => row.map(t => t && ({ id: t.id, tier: t.tier, row: t.row, col: t.col }))) };
    const raw = JSON.stringify({ version: 1, state: stable, best, newBest });
    if (raw.length <= MAX_BYTES) localStorage.setItem(RUN_KEY, raw);
    else clearRun();
  } catch { /* quota, denied storage: play continues */ }
}
