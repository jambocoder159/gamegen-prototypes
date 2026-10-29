// Rebirth: trade this run's progress for sun coins. Resets dew, plants, plots,
// pot upgrades, stage and seed count; keeps sun coins, lifetime coins, relics,
// the codex, the best stage ever and the rebirth count. The Ancient Acorn relic
// seeds the next run with some starting dew.

import { freshCounters, type GameState } from './logic';
import { START_PLOTS, PLOT_COUNT, UPGRADE_COUNT, R, rebirthCoins } from './config';
import { relicFx } from './relics';

/** Coins the player would gain by rebirthing right now (0 if not yet eligible). */
export function rebirthPreview(s: GameState): number {
  return rebirthCoins(s.maxStage, s.grewTree, s.relics[R.lotus]);
}

export interface RebirthResult {
  state: GameState;
  ok: boolean;
  coins: number;
}

/** Perform a rebirth. No-op (ok: false) if not yet eligible. */
export function applyRebirth(s: GameState): RebirthResult {
  const coins = rebirthPreview(s);
  if (coins <= 0) return { state: s, ok: false, coins: 0 };
  const state: GameState = {
    ...s,
    runStats: freshCounters(),
    dew: relicFx.acornDew(s.relics[R.acorn]),
    plots: new Array(PLOT_COUNT).fill(0),
    unlocked: START_PLOTS,
    upgrades: new Array(UPGRADE_COUNT).fill(0),
    seedsBought: 0,
    stage: 1,
    earned: 0,
    maxStage: 1,
    grewTree: false,
    sunCoins: s.sunCoins + coins,
    lifetimeCoins: s.lifetimeCoins + coins,
    rebirths: s.rebirths + 1,
    // kept: maxStageEver, discovered, relics, rng
  };
  return { state, ok: true, coins };
}
