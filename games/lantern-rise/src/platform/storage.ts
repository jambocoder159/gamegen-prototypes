import { GameSim } from '../game/logic';
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


const RUN_KEY = 'lantern-rise.run';
const MAX_RUN_BYTES = 150000;
export function clearRun(): void {
  try { localStorage.removeItem(RUN_KEY); } catch { /* storage unavailable */ }
}
export function saveRun(sim: GameSim): void {
  if (sim.over) { clearRun(); return; }
  try {
    const raw = JSON.stringify(sim.snapshot());
    if (raw.length <= MAX_RUN_BYTES) localStorage.setItem(RUN_KEY, raw);
  } catch { /* quota or storage unavailable */ }
}
export function loadRun(): GameSim | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const sim = raw.length <= MAX_RUN_BYTES ? GameSim.restore(JSON.parse(raw)) : null;
    if (sim) return sim;
  } catch { /* invalid JSON or unavailable storage */ }
  clearRun();
  return null;
}
export function coachSeen(): boolean {
  try { return localStorage.getItem('lantern-rise.coach') === '1'; } catch { return false; }
}
export function markCoachSeen(): void {
  try { localStorage.setItem('lantern-rise.coach', '1'); } catch { /* unavailable */ }
}
