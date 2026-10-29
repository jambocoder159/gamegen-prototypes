import { ANIMALS, TOPPINGS, type GameState, type Customer, type Topping } from './logic';

export const RUN_KEY = 'noodle_night_run';
const BEST_KEY = 'noodle_night_best';
const COACH_KEY = 'noodle_night_coach_v1';
const LIMIT = 16000;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, integer = false): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v));
const toppings = (v: unknown, min = 0): v is Topping[] => Array.isArray(v) && v.length >= min && v.length <= 4 &&
  v.every((t) => TOPPINGS.includes(t)) && new Set(v).size === v.length;

// Construct only known fields after validation; never trust a parsed object as state.
export function decodeRun(raw: string | null): GameState | null {
  if (!raw || raw.length > LIMIT) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!record(saved) || saved.version !== 1 || !record(saved.state)) return null;
    const s = saved.state;
    if (s.status !== 'playing' || !num(s.rng, -2147483648, 2147483647, true) ||
      !num(s.seatsOpen, 1, 2, true) || !num(s.hearts, 1, 3, true) ||
      !num(s.coins, 0, 1e12, true) || !num(s.combo, 0, 1e7, true) ||
      !num(s.bestCombo, s.combo, 1e7, true) || !num(s.served, s.bestCombo, 1e7, true) ||
      !num(s.elapsed, 0, 1e9) || !num(s.nextId, 1, 1e8, true) ||
      !num(s.spawnTimer, 0, 0.5) || !toppings(s.bowl) ||
      !Array.isArray(s.customers) || s.customers.length > s.seatsOpen) return null;
    const customers: Customer[] = [];
    for (const c of s.customers) {
      if (!record(c) || !num(c.id, 1, s.nextId - 1, true) ||
        !ANIMALS.includes(c.animal as Customer['animal']) || !toppings(c.order, 1) ||
        !num(c.patienceMax, 7, 48) || !num(c.patience, 0, c.patienceMax) ||
        !num(c.enteredAt, 0, s.elapsed) || !num(c.seat, 0, s.seatsOpen - 1, true) ||
        (c.phase !== 'ordering' && c.phase !== 'leaving') ||
        (c.leaveExpr !== 'happy' && c.leaveExpr !== 'angry') ||
        !num(c.leaveTimer, 0, 0.9) || !num(c.flashTimer, 0, 0.6)) return null;
      customers.push({ id: c.id, animal: c.animal as Customer['animal'], order: [...c.order],
        patienceMax: c.patienceMax, patience: c.patience, enteredAt: c.enteredAt, seat: c.seat,
        phase: c.phase, leaveExpr: c.leaveExpr, leaveTimer: c.leaveTimer, flashTimer: c.flashTimer });
    }
    if (new Set(customers.map((c) => c.id)).size !== customers.length ||
      new Set(customers.map((c) => c.seat)).size !== customers.length ||
      (s.selectedId !== null && !customers.some((c) => c.id === s.selectedId && c.phase === 'ordering'))) return null;
    return { rng: s.rng, seatsOpen: s.seatsOpen, hearts: s.hearts, coins: s.coins,
      combo: s.combo, bestCombo: s.bestCombo, served: s.served, elapsed: s.elapsed,
      nextId: s.nextId, spawnTimer: s.spawnTimer, bowl: [...s.bowl], customers,
      selectedId: s.selectedId as number | null, status: 'playing', events: [] };
  } catch { return null; }
}

export function clearRun(): void {
  try { localStorage.removeItem(RUN_KEY); } catch { /* storage unavailable */ }
}
export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    const state = decodeRun(raw);
    if (raw && !state) clearRun();
    return state;
  } catch { return null; }
}
export function saveRun(state: GameState): void {
  if (state.status !== 'playing') { clearRun(); return; }
  try {
    const raw = JSON.stringify({ version: 1, state: { ...state, events: [] } });
    if (raw.length <= LIMIT) localStorage.setItem(RUN_KEY, raw);
  } catch { /* full or unavailable storage must never interrupt play */ }
}
export function loadBest(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return num(value, 0, 1e12, true) ? value : 0;
  } catch { return 0; }
}
export function saveBest(score: number): void {
  try { localStorage.setItem(BEST_KEY, String(Math.max(loadBest(), score))); } catch { /* unavailable */ }
}
export function needsCoach(): boolean {
  try { return localStorage.getItem(COACH_KEY) !== 'seen'; } catch { return true; }
}
export function rememberCoach(): void {
  try { localStorage.setItem(COACH_KEY, 'seen'); } catch { /* unavailable */ }
}
