// Deterministic level set for Shelf Sort. Each level is generated from a
// level-seeded PRNG: all goods are laid into the shelves (reserving one fully
// empty shelf as the solver's workspace), boards that are already complete or
// that the solver cannot finish are rejected, and the first seed that passes is
// kept. Greedy solutions drive the demo; exact par and explicit star budgets
// are used for levels 2–4. Generation runs once and is memoised.

import { SLOTS_PER_SHELF, shelfComplete, type Board } from './logic';
import { solve } from './solver';

export const LEVEL_COUNT = 12;

export interface Level {
  index: number; // 0-based
  number: number; // 1-based, for display
  S: number; // shelf count
  K: number; // goods-type count
  board: Board; // start board (length S*3)
  par: number; // exact for levels 2–4, greedy solution length otherwise
  budgets?: { three: number; two: number };
}

// K and S per level (PLAN §3): K ramps 3→8, S=K+2 for levels 1–6, S=K+1 for 7–12.
const SPECS: Array<{ K: number; S: number }> = [
  { K: 3, S: 5 }, { K: 3, S: 5 },
  { K: 4, S: 6 }, { K: 4, S: 6 },
  { K: 5, S: 7 }, { K: 5, S: 7 },
  { K: 6, S: 7 }, { K: 6, S: 7 },
  { K: 7, S: 8 }, { K: 7, S: 8 },
  { K: 8, S: 9 }, { K: 8, S: 9 },
];

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** Lay K×3 goods into S shelves, keeping one random shelf fully empty. */
function buildCandidate(K: number, S: number, rng: () => number): Board {
  const board: Board = new Array(S * SLOTS_PER_SHELF).fill(null);
  const tokens: number[] = [];
  for (let t = 0; t < K; t++) for (let c = 0; c < 3; c++) tokens.push(t);
  shuffle(tokens, rng);

  const reserved = Math.floor(rng() * S); // guaranteed-empty workspace shelf
  const openSlots: number[] = [];
  for (let s = 0; s < S; s++) {
    if (s === reserved) continue;
    const base = s * SLOTS_PER_SHELF;
    openSlots.push(base, base + 1, base + 2);
  }
  shuffle(openSlots, rng);
  for (let i = 0; i < tokens.length; i++) board[openSlots[i]] = tokens[i];
  return board;
}

function generate(index: number): Level {
  const { K, S } = SPECS[index];
  let seed = Math.imul(index + 1, 0x9e3779b1) >>> 0;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const rng = mulberry32((seed + Math.imul(attempt, 0x85ebca77)) >>> 0);
    const board = buildCandidate(K, S, rng);
    let complete = false;
    for (let s = 0; s < S; s++) if (shelfComplete(board, s)) { complete = true; break; }
    if (complete) continue;
    const sol = solve(board);
    if (!sol || sol.length === 0) continue;
    // Exact optima verified by test:logic's exhaustive IDA* search.
    const optimum = [undefined, 5, 7, 5][index];
    return { index, number: index + 1, S, K, board, par: optimum ?? sol.length,
      ...(optimum === undefined ? {} : { budgets: { three: optimum + 1, two: optimum + 4 } }) };
  }
  throw new Error(`could not generate level ${index + 1}`);
}

let cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (!cache) cache = SPECS.map((_, i) => generate(i));
  return cache;
}

export function getLevel(index: number): Level {
  return getLevels()[index];
}
