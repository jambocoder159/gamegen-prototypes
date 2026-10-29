// Title-screen bot: greedy 1-ply. For each legal move it scores
// (merges + resulting empties) and picks the best, breaking ties at random.
// Returns null when no move changes the board (caller restarts the demo).

import { evaluate, type Dir, type GameState } from './logic';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

export function chooseMove(state: GameState, rand: () => number): Dir | null {
  let best: Dir[] = [];
  let bestScore = -Infinity;
  for (const dir of DIRS) {
    const { changed, merges, empties } = evaluate(state, dir);
    if (!changed) continue;
    const score = merges + empties;
    if (score > bestScore) {
      bestScore = score;
      best = [dir];
    } else if (score === bestScore) {
      best.push(dir);
    }
  }
  if (best.length === 0) return null;
  return best[Math.floor(rand() * best.length)];
}
