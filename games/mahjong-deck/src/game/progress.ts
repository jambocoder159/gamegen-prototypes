// Persistence: the best score only, in localStorage. Reads are validated so
// tampered or corrupt storage can never break the game.

const KEY = 'mahjong-deck.best';

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw));
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return 0;
}

export function saveBest(score: number): number {
  const best = Math.max(loadBest(), Math.max(0, Math.floor(score)));
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* ignore */
  }
  return best;
}
