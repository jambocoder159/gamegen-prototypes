// Buying pot upgrades and expanding plots. Pure functions over GameState; they
// spend dew only (no stage credit), so they don't need the full derive(). ×1 and
// "max" (buy as many levels as the current dew allows) are both supported.

import type { GameState } from './logic';
import {
  UPGRADES,
  upgradeCost as upgradeCostFn,
  plotCost,
  PLOT_COUNT,
  START_PLOTS,
} from './config';
import { costDiscount } from './relics';

export interface BuyUpgradeResult {
  state: GameState;
  bought: number; // how many levels were purchased
  spent: number;
}

/** Buy `index`'s upgrade. mode 'one' buys a single level; 'max' buys as many as affordable. */
export function buyUpgrade(s: GameState, index: number, mode: 'one' | 'max'): BuyUpgradeResult {
  const def = UPGRADES[index];
  if (!def) return { state: s, bought: 0, spent: 0 };
  const discount = costDiscount(s.relics);
  let level = s.upgrades[index];
  let dew = s.dew;
  let bought = 0;
  let spent = 0;
  const limit = mode === 'one' ? 1 : Infinity;
  while (bought < limit && level < def.max) {
    const cost = upgradeCostFn(index, level, discount);
    if (dew < cost) break;
    dew -= cost;
    spent += cost;
    level += 1;
    bought += 1;
  }
  if (bought === 0) return { state: s, bought: 0, spent: 0 };
  const upgrades = s.upgrades.slice();
  upgrades[index] = level;
  return { state: { ...s, dew, upgrades }, bought, spent };
}

export interface BuyPlotResult {
  state: GameState;
  ok: boolean;
  cost: number;
}

/** Unlock the next garden plot (START_PLOTS→PLOT_COUNT). */
export function buyPlot(s: GameState): BuyPlotResult {
  if (s.unlocked >= PLOT_COUNT) return { state: s, ok: false, cost: Infinity };
  const cost = Math.ceil(plotCost(s.unlocked - START_PLOTS) * (1 - costDiscount(s.relics)));
  if (s.dew < cost) return { state: s, ok: false, cost };
  return { state: { ...s, dew: s.dew - cost, unlocked: s.unlocked + 1 }, ok: true, cost };
}
