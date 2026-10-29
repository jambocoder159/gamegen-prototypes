// Best-score persistence. Guarded with try/catch and validated as a finite,
// non-negative integer (platform rule 10).

const BEST_KEY = 'lantern-rise.best';

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

export function saveBest(score: number): void {
  if (!Number.isFinite(score) || score < 0) return;
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    /* ignore */
  }
}
