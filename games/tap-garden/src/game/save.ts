// Persistence for the garden (v2). The whole GameState plus a timestamp (offline
// earnings) and the one-time Golden World Tree celebration flag. Every field is
// validated on read, so corrupt / tampered storage can never throw — anything
// wrong falls back to a fresh garden. A v1 save (dew, plots, tapLevel, discovered)
// is migrated: dew / plots / codex are kept, tapLevel becomes the Pot Power level,
// and plots are unlocked to cover the planted cells.

import {
  PLOT_COUNT,
  PLOT_UNLOCK_ORDER,
  isPlotUnlocked,
  START_PLOTS,
  MAX_LEVEL,
  UPGRADE_COUNT,
  UPGRADES,
  U,
  RELIC_COUNT,
  RELICS,
} from './config';
import { newGame, type GameState } from './logic';

const KEY = 'tap-garden.save';
const VERSION = 2;
const MAX_STAGE = 1000; // sanity bound for stage numbers read from storage

export interface SaveBundle {
  state: GameState;
  savedAt: number;
  celebrated: boolean;
}

function num(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function intIn(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.floor(num(v, dflt));
  return Math.min(hi, Math.max(lo, n));
}
function intArray(v: unknown, len: number, lo: number, hi: number): number[] {
  const src = Array.isArray(v) ? v : [];
  return new Array(len).fill(0).map((_, i) => intIn(src[i], lo, hi, 0));
}

/** Clear any plant sitting on a locked plot (tampered data) so the invariant
 * "plants only on unlocked plots" always holds. */
function clampToUnlocked(plots: number[], unlocked: number): number[] {
  return plots.map((lv, i) => (isPlotUnlocked(i, unlocked) ? lv : 0));
}

function migrateV1(data: Record<string, unknown>): GameState {
  const base = newGame();
  // Preserve plant positions and unlock enough plots to cover the last plant in the unlock order.
  const plots = intArray(data.plots, PLOT_COUNT, 0, MAX_LEVEL);
  const unlocked = Math.max(START_PLOTS, plots.reduce((n, lv, i) => lv > 0 ? Math.max(n, PLOT_UNLOCK_ORDER.indexOf(i) + 1) : n, 0));
  const tapLevel = intIn(data.tapLevel, 1, 9999, 1);
  const upgrades = new Array(UPGRADE_COUNT).fill(0);
  upgrades[U.power] = tapLevel - 1; // v1 tapLevel starts at 1 ≙ Pot Power level 0
  const topPlanted = plots.reduce((m, lv) => Math.max(m, lv), 0);
  return {
    ...base,
    dew: Math.max(0, num(data.dew, 0)),
    plots,
    unlocked,
    upgrades,
    seedsBought: intIn(data.seedsBought, 0, Number.MAX_SAFE_INTEGER, 0),
    discovered: Math.max(topPlanted, intIn(data.discovered ?? data.maxLevel, 0, MAX_LEVEL, topPlanted)),
    grewTree: topPlanted >= MAX_LEVEL,
    rng: intIn(data.rng, 0, 0xffffffff, base.rng) >>> 0,
  };
}

function parseV2(data: Record<string, unknown>): GameState {
  const base = newGame();
  const unlocked = intIn(data.unlocked, START_PLOTS, PLOT_COUNT, START_PLOTS);
  const plots = clampToUnlocked(intArray(data.plots, PLOT_COUNT, 0, MAX_LEVEL), unlocked);
  const upgrades = intArray(data.upgrades, UPGRADE_COUNT, 0, Number.MAX_SAFE_INTEGER).map((lv, i) =>
    Math.min(lv, UPGRADES[i].max),
  );
  const relics = intArray(data.relics, RELIC_COUNT, 0, Number.MAX_SAFE_INTEGER).map((lv, i) =>
    Math.min(lv, RELICS[i].max),
  );
  const stage = intIn(data.stage, 1, MAX_STAGE, 1);
  const maxStage = Math.max(stage, intIn(data.maxStage, 1, MAX_STAGE, stage));
  const topPlanted = plots.reduce((m, lv) => Math.max(m, lv), 0);
  const sunCoins = Math.max(0, Math.floor(num(data.sunCoins, 0)));
  return {
    dew: Math.max(0, num(data.dew, 0)),
    plots,
    unlocked,
    upgrades,
    seedsBought: intIn(data.seedsBought, 0, Number.MAX_SAFE_INTEGER, 0),
    stage,
    earned: Math.max(0, num(data.earned, 0)),
    maxStage,
    maxStageEver: Math.max(maxStage, intIn(data.maxStageEver, 1, MAX_STAGE, maxStage)),
    grewTree: data.grewTree === true,
    discovered: Math.max(topPlanted, intIn(data.discovered, 0, MAX_LEVEL, topPlanted)),
    sunCoins,
    lifetimeCoins: Math.max(sunCoins, Math.floor(num(data.lifetimeCoins, 0))),
    rebirths: intIn(data.rebirths, 0, Number.MAX_SAFE_INTEGER, 0),
    relics,
    rng: intIn(data.rng, 0, 0xffffffff, base.rng) >>> 0,
  };
}

/** Read + validate the save, or null when there is none / it is unusable. */
export function loadSave(): SaveBundle | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const rec = data as Record<string, unknown>;
    let state: GameState;
    if (rec.v === VERSION) state = parseV2(rec);
    else if (rec.v === 1) state = migrateV1(rec);
    else return null;
    return {
      state,
      savedAt: intIn(rec.savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      celebrated: rec.celebrated === true,
    };
  } catch {
    return null;
  }
}

/** Write the current state. `now` is passed in (logic stays time-free). */
export function writeSave(state: GameState, celebrated: boolean, now: number): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: VERSION,
        dew: state.dew,
        plots: state.plots,
        unlocked: state.unlocked,
        upgrades: state.upgrades,
        seedsBought: state.seedsBought,
        stage: state.stage,
        earned: state.earned,
        maxStage: state.maxStage,
        maxStageEver: state.maxStageEver,
        grewTree: state.grewTree,
        discovered: state.discovered,
        sunCoins: state.sunCoins,
        lifetimeCoins: state.lifetimeCoins,
        rebirths: state.rebirths,
        relics: state.relics,
        rng: state.rng,
        celebrated,
        savedAt: now,
      }),
    );
  } catch {
    /* storage unavailable — play without saving */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
