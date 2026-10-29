// Deterministic greedy solver, shared by the level generator (to verify a seed is
// solvable and to compute par), the title demo (plays the real move list) and the
// headless test (as a reference). It always terminates quickly.
//
// Strategy, highest priority first, one move per step:
//   1. Completion — a shelf holding exactly two of type t with one empty slot:
//      bring the third t in (completes → clears). 1 move removes a whole type.
//   2. Extend a build — a "pure" shelf (only type t, 1 item, rest empty): add a
//      second t so step 1 can finish it next.
//   3. Start a build — move one copy of the most-concentrated remaining type into
//      a fully empty shelf (the persistent workspace).
// Because clearing empties a shelf, a fully-empty workspace always exists when
// step 3 is reached, so a solvable board is always driven to the win.

import {
  SLOTS_PER_SHELF,
  shelfSlots,
  cloneBoard,
  clearCompletedShelves,
  shelfComplete,
  isWon,
  type Board,
  type Move,
} from './logic';

interface ShelfInfo {
  s: number;
  items: number[]; // non-null goods in the shelf
  empties: number[]; // empty slot indices
  pureType: number | null; // the single type if all items share one type, else null
}

function scanShelf(board: Board, s: number): ShelfInfo {
  const slots = shelfSlots(s);
  const items: number[] = [];
  const empties: number[] = [];
  for (const i of slots) {
    if (board[i] === null) empties.push(i);
    else items.push(board[i] as number);
  }
  const pureType = items.length > 0 && items.every((v) => v === items[0]) ? items[0] : null;
  return { s, items, empties, pureType };
}

/** First slot index (any shelf) holding `type`, excluding shelf `exclude`. */
function findItem(board: Board, type: number, exclude: number): number {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === type && Math.floor(i / SLOTS_PER_SHELF) !== exclude) return i;
  }
  return -1;
}

function chooseMove(board: Board, shelves: number): Move | null {
  const infos: ShelfInfo[] = [];
  for (let s = 0; s < shelves; s++) infos.push(scanShelf(board, s));

  // 1) Completion: two of a kind + one empty slot.
  for (const info of infos) {
    if (info.pureType !== null && info.items.length === 2 && info.empties.length === 1) {
      const src = findItem(board, info.pureType, info.s);
      if (src >= 0) return { from: src, to: info.empties[0] };
    }
  }

  // 2) Extend a pure single into a pair (prefer the fullest pure shelf).
  let bestExtend: ShelfInfo | null = null;
  for (const info of infos) {
    if (info.pureType !== null && info.items.length === 1 && info.empties.length >= 1) {
      if (!bestExtend || info.items.length > bestExtend.items.length) bestExtend = info;
    }
  }
  if (bestExtend) {
    const src = findItem(board, bestExtend.pureType as number, bestExtend.s);
    if (src >= 0) return { from: src, to: bestExtend.empties[0] };
  }

  // 3) Start a build: move the most-concentrated type into a fully empty shelf.
  const emptyShelf = infos.find((i) => i.items.length === 0);
  if (!emptyShelf) return null; // no workspace → greedy cannot proceed

  // count, per type, its max copies in any single (non-empty) shelf
  const maxInShelf = new Map<number, { count: number; src: number }>();
  for (const info of infos) {
    if (info.items.length === 0) continue;
    const counts = new Map<number, number>();
    for (const t of info.items) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [t, c] of counts) {
      const cur = maxInShelf.get(t);
      if (!cur || c > cur.count) {
        maxInShelf.set(t, { count: c, src: shelfSlots(info.s).find((i) => board[i] === t) as number });
      }
    }
  }
  let pick: { type: number; count: number; src: number } | null = null;
  for (const [t, v] of maxInShelf) {
    if (!pick || v.count > pick.count || (v.count === pick.count && t < pick.type)) {
      pick = { type: t, count: v.count, src: v.src };
    }
  }
  if (!pick) return null;
  return { from: pick.src, to: emptyShelf.empties[0] };
}

/**
 * Returns a move list that wins the board, or null if the greedy gets stuck
 * (treated as unsolvable). Does not mutate the input.
 */
export function solve(board0: Board): Move[] | null {
  const board = cloneBoard(board0);
  const shelves = board.length / SLOTS_PER_SHELF;
  const moves: Move[] = [];
  const limit = shelves * SLOTS_PER_SHELF * 6 + 50;
  while (!isWon(board) && moves.length < limit) {
    const m = chooseMove(board, shelves);
    if (!m) return null;
    const type = board[m.from];
    if (type === null || board[m.to] !== null) return null;
    board[m.to] = type;
    board[m.from] = null;
    if (shelfComplete(board, Math.floor(m.to / SLOTS_PER_SHELF))) clearCompletedShelves(board);
    moves.push(m);
  }
  return isWon(board) ? moves : null;
}

/** Par for a board = greedy solution length (or Infinity if unsolvable). */
export function parFor(board: Board): number {
  const m = solve(board);
  return m ? m.length : Infinity;
}
