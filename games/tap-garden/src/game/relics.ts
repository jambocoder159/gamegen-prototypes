// The 12 relics: permanent prestige bonuses kept across rebirths. Each has a
// level (0 = not owned / shown locked in the codex). The effect accessors are
// shared by derive() and the prestige actions; draw, buy-unlock and upgrade are
// pure functions over GameState so the sim, tests and UI share them. All numbers
// live in config.ts.

import type { GameState } from './logic';
import { pickIndex } from './rng';
import {
  RELICS,
  RELIC_COUNT,
  R,
  DRAW_COST,
  UNLOCK_COST,
  relicUpgradeCost,
  LENS_PER_LEVEL,
  SUN_PER_LEVEL,
  MOON_RATE_PER_LEVEL,
  MOON_CAP_SEC_PER_LEVEL,
  BEE_PER_LEVEL,
  CLOVER_PER_LEVEL,
  THUNDER_PER_LEVEL,
  TROWEL_PER_LEVEL,
  TROWEL_CAP,
  CLOUD_PER_LEVEL,
  LOTUS_PER_LEVEL,
  LADYBUG_PER_LEVEL,
  LADYBUG_CAP,
  CAN_PER_LEVEL,
  CAN_CAP,
  ACORN_BASE,
  ACORN_GROWTH,
  OFFLINE_RATE,
  OFFLINE_RATE_CAP,
  OFFLINE_CAP_SEC,
} from './config';

// --- relic effects at a given level (used by derive() and the codex text) ----
export const relicFx = {
  lensMult: (L: number) => 1 + LENS_PER_LEVEL * L,
  sunMult: (L: number) => 1 + SUN_PER_LEVEL * L,
  offlineRate: (L: number) => Math.min(OFFLINE_RATE_CAP, OFFLINE_RATE + MOON_RATE_PER_LEVEL * L),
  offlineCapSec: (L: number) => OFFLINE_CAP_SEC + MOON_CAP_SEC_PER_LEVEL * L,
  beeMult: (L: number) => 1 + BEE_PER_LEVEL * L,
  cloverChance: (L: number) => CLOVER_PER_LEVEL * L,
  thunderPower: (L: number) => THUNDER_PER_LEVEL * L,
  trowelDiscount: (L: number) => Math.min(TROWEL_CAP, TROWEL_PER_LEVEL * L),
  cloudRate: (L: number) => CLOUD_PER_LEVEL * L,
  lotusMult: (L: number) => 1 + LOTUS_PER_LEVEL * L,
  ladybugChance: (L: number) => Math.min(LADYBUG_CAP, LADYBUG_PER_LEVEL * L),
  canDiscount: (L: number) => Math.min(CAN_CAP, CAN_PER_LEVEL * L),
  acornDew: (L: number) => (L > 0 ? ACORN_BASE * Math.pow(ACORN_GROWTH, L) : 0),
};

export function seedDiscount(relics: number[]): number {
  return relicFx.trowelDiscount(relics[R.trowel]);
}
export function costDiscount(relics: number[]): number {
  return relicFx.canDiscount(relics[R.can]);
}

export function freshRelics(): number[] {
  return new Array(RELIC_COUNT).fill(0);
}

// --- prestige actions (draw / buy-unlock / upgrade) --------------------------
export interface DrawResult {
  state: GameState;
  ok: boolean;
  index: number; // relic drawn (-1 if the draw could not happen)
  newlyOwned: boolean;
  level: number; // the relic's level after the draw
}

/** Draw a random relic for DRAW_COST coins: unlock it at level 1, or +1 if owned
 * (a relic already at its cap is excluded from the pool; no draw when all are). */
export function drawRelic(s: GameState): DrawResult {
  const pool: number[] = [];
  for (let i = 0; i < RELIC_COUNT; i++) if (s.relics[i] < RELICS[i].max) pool.push(i);
  if (s.sunCoins < DRAW_COST || pool.length === 0) {
    return { state: s, ok: false, index: -1, newlyOwned: false, level: 0 };
  }
  const pick = pickIndex(s.rng, pool.length);
  const index = pool[pick.index];
  const relics = s.relics.slice();
  const newlyOwned = relics[index] === 0;
  const level = relics[index] + 1;
  relics[index] = level;
  return {
    state: { ...s, rng: pick.rng, relics, sunCoins: s.sunCoins - DRAW_COST },
    ok: true,
    index,
    newlyOwned,
    level,
  };
}

export interface RelicActionResult {
  state: GameState;
  ok: boolean;
  cost: number;
}

/** Buy-unlock a specific unowned relic for UNLOCK_COST coins (→ level 1). */
export function buyRelic(s: GameState, index: number): RelicActionResult {
  if (index < 0 || index >= RELIC_COUNT || s.relics[index] > 0 || s.sunCoins < UNLOCK_COST) {
    return { state: s, ok: false, cost: UNLOCK_COST };
  }
  const relics = s.relics.slice();
  relics[index] = 1;
  return { state: { ...s, relics, sunCoins: s.sunCoins - UNLOCK_COST }, ok: true, cost: UNLOCK_COST };
}

/** Upgrade an owned relic by one level if affordable and below its cap. */
export function upgradeRelic(s: GameState, index: number): RelicActionResult {
  if (index < 0 || index >= RELIC_COUNT) return { state: s, ok: false, cost: Infinity };
  const level = s.relics[index];
  if (level < 1 || level >= RELICS[index].max) return { state: s, ok: false, cost: Infinity };
  const cost = relicUpgradeCost(index, level);
  if (s.sunCoins < cost) return { state: s, ok: false, cost };
  const relics = s.relics.slice();
  relics[index] = level + 1;
  return { state: { ...s, relics, sunCoins: s.sunCoins - cost }, ok: true, cost };
}
