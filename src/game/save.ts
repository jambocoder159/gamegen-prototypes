// Persistence for the garden: the whole game state plus a timestamp (for offline
// earnings) and a one-time "celebrated the Golden World Tree" flag. Every read is
// validated against the expected shape so corrupt/tampered storage can never
// break the game — anything wrong falls back to a fresh garden.

import { PLOT_COUNT, MAX_LEVEL, tapPowerFor } from '../config/config';
import { newGame, type GameState } from './logic';

const KEY = 'tap-garden.save';
const VERSION = 1;

export interface SaveBundle {
  state: GameState;
  savedAt: number; // ms epoch of the last save
  celebrated: boolean; // has the level-9 celebration been shown?
}

function num(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function intIn(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.floor(num(v, dflt));
  return Math.min(hi, Math.max(lo, n));
}

/** Read + validate the save, or null when there is none / it is unusable. */
export function loadSave(): SaveBundle | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || data.v !== VERSION) return null;

    const base = newGame();
    const plotsRaw = Array.isArray(data.plots) ? data.plots : [];
    const plots = new Array(PLOT_COUNT).fill(0).map((_, i) => intIn(plotsRaw[i], 0, MAX_LEVEL, 0));

    const tapLevel = intIn(data.tapLevel, 1, 9999, 1);
    const maxLevel = intIn(data.maxLevel, 0, MAX_LEVEL, Math.max(0, ...plots));
    const state: GameState = {
      dew: Math.max(0, num(data.dew, 0)),
      tapLevel,
      // tapPower is derived from tapLevel, so recompute to stay consistent.
      tapPower: tapPowerFor(tapLevel),
      seedsBought: intIn(data.seedsBought, 0, Number.MAX_SAFE_INTEGER, 0),
      plots,
      maxLevel,
      rng: intIn(data.rng, 0, 0xffffffff, base.rng) >>> 0,
    };
    return {
      state,
      savedAt: intIn(data.savedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      celebrated: data.celebrated === true,
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
        tapLevel: state.tapLevel,
        tapPower: state.tapPower,
        seedsBought: state.seedsBought,
        plots: state.plots,
        maxLevel: state.maxLevel,
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
