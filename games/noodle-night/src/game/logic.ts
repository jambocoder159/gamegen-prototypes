// Noodle Night — pure game logic. No React, no DOM. Time-stepped via step(state, dt)
// with an injectable seed for the RNG. The UI renders a snapshot each frame and calls
// the action functions in response to input.

export const TOPPINGS = ['egg', 'scallion', 'pork', 'fishcake', 'chili', 'bokchoy'] as const;
export type Topping = (typeof TOPPINGS)[number];

export const ANIMALS = ['cat', 'bear', 'fox', 'rabbit'] as const;
export type Animal = (typeof ANIMALS)[number];

export type Expr = 'wait' | 'happy' | 'angry';
export type GameEvent = 'ok' | 'wrong' | 'over' | 'leave_angry';

// ---- tunables -------------------------------------------------------------
export const CONFIG = {
  maxHearts: 3,
  patienceStart: 16, // seconds for the very first customers
  patienceFloor: 7, // lower bound after ramping
  patienceDecayPerServed: 0.7, // seconds shaved off per customer served
  secondSeatAt: 6, // served count that opens the 2nd seat
  reactionHappy: 0.9, // seconds showing the happy face before leaving
  reactionAngry: 0.9, // seconds showing the angry face before leaving
  flashWrong: 0.6, // seconds the angry flash lasts on a wrong serve (stays seated)
  spawnDelay: 0.5, // gap before a freed seat is refilled
  wrongPatienceKeep: 0.75, // patience retained after a wrong serve (−25%)
  coinsPerTopping: 10,
  patienceBonusMax: 10, // extra coins for serving fast
  comboStep: 0.25,
  comboCap: 2.5,
  maxBowl: 4, // orders never exceed 4 toppings
} as const;

export interface Customer {
  id: number;
  animal: Animal;
  order: Topping[]; // canonical-sorted set
  patienceMax: number;
  patience: number;
  enteredAt: number;
  seat: number; // 0 or 1
  phase: 'ordering' | 'leaving';
  leaveExpr: Expr; // happy | angry while leaving
  leaveTimer: number;
  flashTimer: number; // >0 => show angry flash (wrong serve), still seated
}

export interface GameState {
  rng: number;
  seatsOpen: number;
  customers: Customer[];
  selectedId: number | null;
  bowl: Topping[]; // insertion order (stable visual slots)
  hearts: number;
  coins: number;
  combo: number; // consecutive correct serves
  bestCombo: number;
  served: number;
  status: 'playing' | 'over';
  elapsed: number;
  nextId: number;
  spawnTimer: number;
  events: GameEvent[];
}

export interface ServeResult {
  ok: boolean;
  coins: number;
  combo: number;
}

// ---- RNG (mulberry32, mutates state.rng in place) -------------------------
function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

// ---- helpers --------------------------------------------------------------
function maxOrderSize(served: number): number {
  if (served < 4) return 2;
  if (served < 8) return 3;
  return 4;
}

function minOrderSize(served: number): number {
  return served < 8 ? 1 : 2;
}

function patienceFor(served: number): number {
  return Math.max(CONFIG.patienceFloor, CONFIG.patienceStart - served * CONFIG.patienceDecayPerServed);
}

export function comboMultiplier(combo: number): number {
  if (combo <= 0) return 1;
  return Math.min(CONFIG.comboCap, 1 + CONFIG.comboStep * (combo - 1));
}

function makeOrder(s: GameState, served: number): Topping[] {
  const size = randInt(s, minOrderSize(served), maxOrderSize(served));
  const pool = [...TOPPINGS] as Topping[];
  const chosen = new Set<Topping>();
  for (let i = 0; i < size; i++) {
    const idx = randInt(s, 0, pool.length - 1);
    chosen.add(pool.splice(idx, 1)[0]);
  }
  return TOPPINGS.filter((t) => chosen.has(t));
}

function occupiedSeats(s: GameState): Set<number> {
  const set = new Set<number>();
  for (const c of s.customers) set.add(c.seat);
  return set;
}

function spawnCustomer(s: GameState): void {
  const used = occupiedSeats(s);
  let seat = 0;
  while (used.has(seat) && seat < s.seatsOpen) seat++;
  const p = patienceFor(s.served);
  const c: Customer = {
    id: s.nextId++,
    animal: ANIMALS[randInt(s, 0, ANIMALS.length - 1)],
    order: makeOrder(s, s.served),
    patienceMax: p,
    patience: p,
    enteredAt: s.elapsed,
    seat,
    phase: 'ordering',
    leaveExpr: 'happy',
    leaveTimer: 0,
    flashTimer: 0,
  };
  s.customers.push(c);
  s.spawnTimer = CONFIG.spawnDelay;
}

function oldestOrdering(s: GameState): Customer | null {
  let best: Customer | null = null;
  for (const c of s.customers) {
    if (c.phase !== 'ordering') continue;
    if (!best || c.enteredAt < best.enteredAt) best = c;
  }
  return best;
}

function ensureSelection(s: GameState): void {
  const sel = s.customers.find((c) => c.id === s.selectedId && c.phase === 'ordering');
  if (!sel) {
    const o = oldestOrdering(s);
    s.selectedId = o ? o.id : null;
  }
}

// ---- lifecycle ------------------------------------------------------------
export function createGame(seed: number): GameState {
  const s: GameState = {
    rng: seed | 0,
    seatsOpen: 1,
    customers: [],
    selectedId: null,
    bowl: [],
    hearts: CONFIG.maxHearts,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    status: 'playing',
    elapsed: 0,
    nextId: 1,
    spawnTimer: 0,
    events: [],
  };
  spawnCustomer(s);
  ensureSelection(s);
  return s;
}

export function step(state: GameState, dt: number): void {
  if (state.status !== 'playing') return;
  const dts = Math.min(0.05, Math.max(0, dt)); // cap dt (seconds)
  state.elapsed += dts;
  state.seatsOpen = state.served >= CONFIG.secondSeatAt ? 2 : 1;

  let heartsLost = 0;

  for (const c of state.customers) {
    if (c.phase === 'ordering') {
      if (c.flashTimer > 0) c.flashTimer = Math.max(0, c.flashTimer - dts);
      c.patience -= dts;
      if (c.patience <= 0) {
        c.patience = 0;
        c.phase = 'leaving';
        c.leaveExpr = 'angry';
        c.leaveTimer = CONFIG.reactionAngry;
        heartsLost += 1;
        state.combo = 0;
        state.events.push('leave_angry');
      }
    } else {
      c.leaveTimer -= dts;
    }
  }

  if (heartsLost > 0) state.hearts -= heartsLost;

  // remove finished leavers
  let removed = false;
  state.customers = state.customers.filter((c) => {
    if (c.phase === 'leaving' && c.leaveTimer <= 0) {
      removed = true;
      return false;
    }
    return true;
  });
  if (removed) state.spawnTimer = CONFIG.spawnDelay;

  if (state.hearts <= 0) {
    state.hearts = 0;
    state.status = 'over';
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.events.push('over');
    return;
  }

  // refill seats
  if (state.customers.length < state.seatsOpen) {
    state.spawnTimer -= dts;
    if (state.spawnTimer <= 0) spawnCustomer(state);
  }

  ensureSelection(state);
  state.bestCombo = Math.max(state.bestCombo, state.combo);
}

// ---- actions --------------------------------------------------------------
export type ToggleResult = 'added' | 'removed' | 'none';

export function toggleTopping(state: GameState, t: Topping): ToggleResult {
  if (state.status !== 'playing') return 'none';
  const i = state.bowl.indexOf(t);
  if (i >= 0) {
    state.bowl.splice(i, 1);
    return 'removed';
  }
  if (state.bowl.length >= CONFIG.maxBowl) return 'none';
  state.bowl.push(t);
  return 'added';
}

export function clearBowl(state: GameState): boolean {
  if (state.status !== 'playing' || state.bowl.length === 0) return false;
  state.bowl = [];
  return true;
}

export function selectCustomer(state: GameState, id: number): void {
  const c = state.customers.find((x) => x.id === id && x.phase === 'ordering');
  if (c) state.selectedId = id;
}

export function cycleSelection(state: GameState, dir: number): void {
  const ordering = state.customers
    .filter((c) => c.phase === 'ordering')
    .sort((a, b) => a.seat - b.seat);
  if (ordering.length === 0) return;
  const idx = ordering.findIndex((c) => c.id === state.selectedId);
  const next = (idx + dir + ordering.length) % ordering.length;
  state.selectedId = ordering[next].id;
}

function sameSet(a: Topping[], b: Topping[]): boolean {
  if (a.length !== b.length) return false;
  const sa = TOPPINGS.filter((t) => a.includes(t));
  const sb = TOPPINGS.filter((t) => b.includes(t));
  return sa.every((t, i) => t === sb[i]);
}

export function serve(state: GameState): ServeResult | null {
  if (state.status !== 'playing') return null;
  const c = state.customers.find((x) => x.id === state.selectedId && x.phase === 'ordering');
  if (!c) return null;

  if (sameSet(state.bowl, c.order)) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const bonus = Math.round(CONFIG.patienceBonusMax * (c.patience / c.patienceMax));
    const base = CONFIG.coinsPerTopping * c.order.length + bonus;
    const gain = Math.round(base * comboMultiplier(state.combo));
    state.coins += gain;
    state.served += 1;
    c.phase = 'leaving';
    c.leaveExpr = 'happy';
    c.leaveTimer = CONFIG.reactionHappy;
    state.bowl = [];
    state.selectedId = null;
    state.events.push('ok');
    ensureSelection(state);
    return { ok: true, coins: gain, combo: state.combo };
  }

  // wrong
  state.hearts -= 1;
  state.combo = 0;
  state.bowl = [];
  c.patience *= CONFIG.wrongPatienceKeep;
  c.flashTimer = CONFIG.flashWrong;
  state.events.push('wrong');
  if (state.hearts <= 0) {
    state.hearts = 0;
    state.status = 'over';
    state.events.push('over');
  }
  return { ok: false, coins: 0, combo: 0 };
}

// Display expression for a customer (pure, UI uses it to pick the image).
export function expressionOf(c: Customer): Expr {
  if (c.phase === 'leaving') return c.leaveExpr;
  if (c.flashTimer > 0) return 'angry';
  return 'wait';
}

export function drainEvents(state: GameState): GameEvent[] {
  if (state.events.length === 0) return [];
  const e = state.events;
  state.events = [];
  return e;
}
