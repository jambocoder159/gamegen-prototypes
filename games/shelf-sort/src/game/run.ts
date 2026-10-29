import { applyMove, isWon, newGame, type GameState } from './logic';
import { getLevel, LEVEL_COUNT } from './levels';

const KEY = 'shelf-sort.run';
const MAX_BYTES = 200_000;
const MAX_MOVES = 5000;
export interface SavedRun { level: number; state: GameState; selected: number | null }

export function clearRun(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage may be unavailable */ }
}

// Replaying a bounded, typed move list validates every board and undo snapshot.
// Reject the whole record on any bad field, illegal move, or finished run.
export function loadRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    if (raw.length > MAX_BYTES) throw new Error('oversized run');
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Number.isInteger(data.level) || data.level < 1 ||
        data.level > LEVEL_COUNT || !Array.isArray(data.path) ||
        data.path.length > MAX_MOVES) throw new Error('invalid run');
    const lv = getLevel(data.level - 1);
    const state = newGame(lv.S, lv.K, lv.board);
    for (const move of data.path) {
      if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to) ||
          isWon(state.board) || !applyMove(state, move.from, move.to).ok) throw new Error('illegal replay');
    }
    if (isWon(state.board) || (state.moves === 0 && data.selected === null) || (data.selected !== null &&
        (!Number.isInteger(data.selected) || data.selected < 0 || data.selected >= state.board.length ||
        state.board[data.selected] === null))) throw new Error('invalid selection');
    return { level: data.level, state, selected: data.selected };
  } catch { clearRun(); return null; }
}

export function saveRun(run: SavedRun): void {
  try {
    if ((run.state.moves === 0 && run.selected === null) || isWon(run.state.board)) { clearRun(); return; }
    if (run.state.path.length > MAX_MOVES) { clearRun(); return; }
    const raw = JSON.stringify({ version: 1, level: run.level, path: run.state.path, selected: run.selected });
    if (raw.length > MAX_BYTES) { clearRun(); return; }
    localStorage.setItem(KEY, raw);
  } catch { /* quota/private browsing must not interrupt play */ }
}
