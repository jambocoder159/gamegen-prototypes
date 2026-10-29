// Shelf Sort — pure game logic. No React, no DOM, fully deterministic, so the UI,
// the title demo and the headless test all drive it the same way.
//
// Model: S shelves × 3 slots. A slot holds a goods type id (0..K-1) or null
// (empty). A move relocates one item from a filled slot to an empty slot. After
// a move, if the destination shelf holds 3 identical goods it "clears" — those
// three slots become empty again. You win when every slot is empty.

export const SLOTS_PER_SHELF = 3;

export type Slot = number | null; // goods type id, or null = empty
export type Board = Slot[]; // length S * 3; index i → shelf i/3, position i%3

export interface GameState {
  readonly S: number; // shelf count
  readonly K: number; // goods-type count
  board: Board;
  moves: number; // relocations made (clears are free)
  history: Board[]; // board snapshots before each move (for unlimited undo)
  path: Move[]; // replayable, validated reload recovery
}

export interface Move {
  from: number; // source slot index (filled)
  to: number; // destination slot index (empty)
}

/** Shelf index that slot `i` belongs to. */
export function shelfOf(i: number): number {
  return Math.floor(i / SLOTS_PER_SHELF);
}

/** The three slot indices of shelf `s`. */
export function shelfSlots(s: number): [number, number, number] {
  const b = s * SLOTS_PER_SHELF;
  return [b, b + 1, b + 2];
}

export function cloneBoard(b: Board): Board {
  return b.slice();
}

/** A shelf is complete when all three slots hold the same non-null goods. */
export function shelfComplete(board: Board, s: number): boolean {
  const [a, b, c] = shelfSlots(s);
  return board[a] !== null && board[a] === board[b] && board[b] === board[c];
}

/** Clear every complete shelf in place; returns how many shelves cleared. */
export function clearCompletedShelves(board: Board): number[] {
  const cleared: number[] = [];
  const shelves = board.length / SLOTS_PER_SHELF;
  for (let s = 0; s < shelves; s++) {
    if (shelfComplete(board, s)) {
      const [a, b, c] = shelfSlots(s);
      board[a] = board[b] = board[c] = null;
      cleared.push(s);
    }
  }
  return cleared;
}

/** True once every slot is empty. */
export function isWon(board: Board): boolean {
  return board.every((v) => v === null);
}

export function newGame(S: number, K: number, board: Board): GameState {
  return { S, K, board: cloneBoard(board), moves: 0, history: [], path: [] };
}

export interface MoveResult {
  ok: boolean; // was the move legal and applied?
  cleared: number[]; // shelves cleared by this move (indices, before emptying)
  clearedType: number | null; // goods type of the cleared shelf (for effects)
  won: boolean;
}

/**
 * Apply a relocation. Legal when `from` holds an item and `to` is a different,
 * empty slot. Pushes an undo snapshot, moves the item, then clears any completed
 * shelf. Mutates and returns a result describing what happened.
 */
export function applyMove(state: GameState, from: number, to: number): MoveResult {
  if (
    !Number.isInteger(from) || !Number.isInteger(to) || from === to ||
    from < 0 ||
    to < 0 ||
    from >= state.board.length ||
    to >= state.board.length ||
    state.board[from] === null ||
    state.board[to] !== null
  ) {
    return { ok: false, cleared: [], clearedType: null, won: false };
  }
  state.history.push(cloneBoard(state.board));
  const type = state.board[from];
  state.board[to] = type;
  state.board[from] = null;
  state.moves += 1;
  state.path.push({ from, to });
  const destShelf = shelfOf(to);
  let cleared: number[] = [];
  let clearedType: number | null = null;
  if (shelfComplete(state.board, destShelf)) {
    clearedType = type;
    cleared = clearCompletedShelves(state.board);
  }
  return { ok: true, cleared, clearedType, won: isWon(state.board) };
}

/** Revert the last move (restoring a cleared shelf too). Returns false if none. */
export function undo(state: GameState): boolean {
  const prev = state.history.pop();
  if (!prev) return false;
  state.board = prev;
  state.moves -= 1;
  state.path.pop();
  return true;
}

/** Star rating for finishing in `moves` against `par`. */
export function starsFor(moves: number, par: number, budgets?: { three: number; two: number }): number {
  if (moves <= (budgets?.three ?? par)) return 3;
  if (moves <= (budgets?.two ?? Math.ceil(par * 1.5))) return 2;
  return 1;
}
