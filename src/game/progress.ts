// Level progress in localStorage: the highest unlocked level and the best star
// rating per level. Reads are validated (any wrong shape falls back to a fresh
// profile) so tampered or corrupt storage can never break the game.

import { LEVEL_COUNT } from './levels';

const KEY = 'shelf-sort.progress';

export interface Progress {
  unlocked: number; // highest unlocked level number (1..LEVEL_COUNT)
  stars: number[]; // length LEVEL_COUNT; best stars 0..3 (0 = not cleared)
}

export function freshProgress(): Progress {
  return { unlocked: 1, stars: new Array(LEVEL_COUNT).fill(0) };
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProgress();
    const data = JSON.parse(raw) as unknown;
    const p = freshProgress();
    if (data && typeof data === 'object') {
      const d = data as { unlocked?: unknown; stars?: unknown };
      p.unlocked = clampInt(d.unlocked, 1, LEVEL_COUNT, 1);
      if (Array.isArray(d.stars)) {
        for (let i = 0; i < LEVEL_COUNT; i++) p.stars[i] = clampInt(d.stars[i], 0, 3, 0);
      }
    }
    return p;
  } catch {
    return freshProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Record a win: raise the best stars and unlock the next level. Returns the new progress. */
export function recordWin(p: Progress, levelNumber: number, stars: number): Progress {
  const next: Progress = { unlocked: p.unlocked, stars: p.stars.slice() };
  const i = levelNumber - 1;
  if (i >= 0 && i < LEVEL_COUNT) next.stars[i] = Math.max(next.stars[i], stars);
  next.unlocked = Math.max(next.unlocked, Math.min(LEVEL_COUNT, levelNumber + 1));
  saveProgress(next);
  return next;
}
