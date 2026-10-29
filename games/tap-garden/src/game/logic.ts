// Tap Garden — pure game logic. No React, no DOM, fully deterministic, so the
// play UI, the title demo bot and the headless test all drive it the same way.
//
// Model: 16 plots in a 4×4 grid. Each plot holds a plant level 1..9, or 0 when
// empty. Tapping the pot earns dew; dew buys seeds (a level-1 plant dropped on a
// random empty plot) and tap-power upgrades; two same-level plants merge into the
// next level (1..8 only — a level-9 pair does nothing); every plant drips dew
// each second on its own. Seed placement uses a seedable RNG carried in the state
// so a given sequence of actions always lays out identically.

import {
  PLOT_COUNT,
  MAX_LEVEL,
  TAP_POWER_BASE,
  RNG_SEED,
  tapPowerFor,
  seedCost,
  upgradeCost,
  incomeForLevel,
  OFFLINE_CAP_SEC,
  OFFLINE_RATE,
} from '../config/config';

export interface GameState {
  dew: number; // floating dew balance
  tapPower: number; // dew gained per pot tap
  tapLevel: number; // tap-power upgrade level (starts at 1)
  seedsBought: number; // seeds purchased so far (drives seed price)
  plots: number[]; // length 16; plant level 1..9 or 0 = empty
  maxLevel: number; // highest plant level ever discovered (0 = none)
  rng: number; // RNG state (uint32) for deterministic seed placement
}

/** A fresh garden. `seed` keeps placement deterministic/repeatable. */
export function newGame(seed: number = RNG_SEED): GameState {
  return {
    dew: 0,
    tapPower: TAP_POWER_BASE,
    tapLevel: 1,
    seedsBought: 0,
    plots: new Array(PLOT_COUNT).fill(0),
    maxLevel: 0,
    rng: seed >>> 0,
  };
}

// --- deterministic RNG (mulberry32) --------------------------------------------
function nextRng(state: number): { rng: number; value: number } {
  const rng = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(rng ^ (rng >>> 15), rng | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { rng: rng >>> 0, value };
}

function emptyPlots(plots: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < plots.length; i++) if (plots[i] === 0) out.push(i);
  return out;
}

export function hasEmptyPlot(s: GameState): boolean {
  return s.plots.some((v) => v === 0);
}

export function canBuySeed(s: GameState): boolean {
  return hasEmptyPlot(s) && s.dew >= seedCost(s.seedsBought);
}

export function canUpgrade(s: GameState): boolean {
  return s.dew >= upgradeCost(s.tapLevel);
}

export function nextSeedCost(s: GameState): number {
  return seedCost(s.seedsBought);
}

export function nextUpgradeCost(s: GameState): number {
  return upgradeCost(s.tapLevel);
}

/** Dew produced per second by every plant currently growing. */
export function incomePerSec(s: GameState): number {
  let sum = 0;
  for (const v of s.plots) sum += incomeForLevel(v);
  return sum;
}

export interface TapResult {
  state: GameState;
  gained: number;
}

/** Tap the pot: earn `tapPower` dew. */
export function tap(s: GameState): TapResult {
  return { state: { ...s, dew: s.dew + s.tapPower }, gained: s.tapPower };
}

export interface BuyResult {
  state: GameState;
  ok: boolean;
  plot: number; // plot the seed landed on (-1 if none)
  cost: number;
  firstEver: boolean; // discovered level 1 for the first time
}

/** Buy a seed: spend dew, drop a level-1 plant on a random empty plot. */
export function buySeed(s: GameState): BuyResult {
  const cost = seedCost(s.seedsBought);
  const empties = emptyPlots(s.plots);
  if (s.dew < cost || empties.length === 0) {
    return { state: s, ok: false, plot: -1, cost, firstEver: false };
  }
  const { rng, value } = nextRng(s.rng);
  const plot = empties[Math.min(empties.length - 1, Math.floor(value * empties.length))];
  const plots = s.plots.slice();
  plots[plot] = 1;
  const firstEver = s.maxLevel < 1;
  return {
    state: {
      ...s,
      dew: s.dew - cost,
      seedsBought: s.seedsBought + 1,
      plots,
      rng,
      maxLevel: Math.max(s.maxLevel, 1),
    },
    ok: true,
    plot,
    cost,
    firstEver,
  };
}

export interface MergeResult {
  state: GameState;
  ok: boolean;
  newLevel: number; // resulting level (0 if the merge was rejected)
  plot: number; // plot the merged plant ends up on (-1 if none)
  isNewMax: boolean; // reached a never-before-seen level
}

/**
 * Merge plant `a` into plant `b`. Legal when both hold the same level 1..8; the
 * result (level+1) lands on `b` and `a` becomes empty. A level-9 pair is a no-op.
 */
export function merge(s: GameState, a: number, b: number): MergeResult {
  const la = s.plots[a];
  const lb = s.plots[b];
  if (a === b || la === 0 || la !== lb || la >= MAX_LEVEL) {
    return { state: s, ok: false, newLevel: 0, plot: -1, isNewMax: false };
  }
  const newLevel = la + 1;
  const plots = s.plots.slice();
  plots[b] = newLevel;
  plots[a] = 0;
  const isNewMax = newLevel > s.maxLevel;
  return {
    state: { ...s, plots, maxLevel: Math.max(s.maxLevel, newLevel) },
    ok: true,
    newLevel,
    plot: b,
    isNewMax,
  };
}

export interface MoveResult {
  state: GameState;
  ok: boolean;
}

/** Move the plant on `a` to the empty plot `b`. */
export function move(s: GameState, a: number, b: number): MoveResult {
  if (a === b || s.plots[a] === 0 || s.plots[b] !== 0) return { state: s, ok: false };
  const plots = s.plots.slice();
  plots[b] = plots[a];
  plots[a] = 0;
  return { state: { ...s, plots }, ok: true };
}

export interface UpgradeResult {
  state: GameState;
  ok: boolean;
  cost: number;
}

/** Upgrade tap power by one level. */
export function upgradeTap(s: GameState): UpgradeResult {
  const cost = upgradeCost(s.tapLevel);
  if (s.dew < cost) return { state: s, ok: false, cost };
  const tapLevel = s.tapLevel + 1;
  return {
    state: { ...s, dew: s.dew - cost, tapLevel, tapPower: tapPowerFor(tapLevel) },
    ok: true,
    cost,
  };
}

/** Advance passive income by `dtSec` seconds. Reuses the plots array. */
export function tick(s: GameState, dtSec: number): GameState {
  const inc = incomePerSec(s) * dtSec;
  return inc > 0 ? { ...s, dew: s.dew + inc } : s;
}

/** Dew earned while away: min(elapsed, 2h) × income/sec × 50%. */
export function offlineEarnings(s: GameState, elapsedSec: number): number {
  const sec = Math.max(0, Math.min(elapsedSec, OFFLINE_CAP_SEC));
  return incomePerSec(s) * sec * OFFLINE_RATE;
}
