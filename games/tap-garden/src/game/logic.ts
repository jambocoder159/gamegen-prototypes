// Tap Garden v2 — pure, deterministic game logic. No React, no DOM. The play UI,
// the title demo bot, the headless test and the economy simulation all drive the
// same functions, so behaviour is identical everywhere. Randomness (seed
// placement, crits, relic draws, seed quality) comes from a seeded RNG carried in
// the state, so a given sequence of actions always plays out the same way.

import {
  PLOT_COUNT,
  unlockedPlots,
  isPlotUnlocked,
  START_PLOTS,
  MAX_LEVEL,
  RNG_SEED,
  REBIRTH_STAGE,
  incomeForLevel,
  seedCost as seedCostFn,
  plotCost,
  upgradeCost as upgradeCostFn,
  UPGRADES,
  UPGRADE_COUNT,
  U,
  R,
  POT_POWER_DOUBLE_EVERY,
  WARMTH_PER_LEVEL,
  CRIT_CHANCE_PER_LEVEL,
  CRIT_CHANCE_CAP,
  CRIT_POWER_BASE,
  CRIT_POWER_PER_LEVEL,
  AUTO_TAP_PER_LEVEL,
  AUTO_TAP_CAP,
  FERT_PER_LEVEL,
  MERGE_BURST_PER_LEVEL,
  MERGE_BURST_SECONDS,
  SEED_QUALITY_PER_LEVEL,
  SEED_QUALITY_CAP,
  LIFETIME_BONUS_PER_COIN,
  STAGE_INCOME_PER_LEVEL,
  stageGoal,
  isBossStage,
  bossRequiredLevel,
  rebirthCoins,
} from './config';
import { nextRng, pickIndex } from './rng';
import { relicFx, seedDiscount, costDiscount, freshRelics } from './relics';
import { settleStages, bossSatisfied } from './stages';

export interface GameState {
  dew: number; // floating dew balance
  plots: number[]; // length 16; plant level 1..9 or 0 = empty
  unlocked: number; // number of unlocked plots (START_PLOTS..PLOT_COUNT)
  upgrades: number[]; // length 8, level per numeric upgrade line
  seedsBought: number; // seeds bought this run (drives seed price)
  stage: number; // current stage (≥ 1)
  earned: number; // dew earned toward the current stage goal
  maxStage: number; // highest stage reached this run
  maxStageEver: number; // highest stage ever (kept across rebirths)
  grewTree: boolean; // grew a level-9 tree this run (rebirth bonus)
  discovered: number; // highest plant level ever seen (codex)
  sunCoins: number; // spendable prestige currency
  lifetimeCoins: number; // total coins ever earned (global bonus, never spent down)
  rebirths: number; // number of rebirths performed
  relics: number[]; // length 12, relic levels (0 = not owned)
  rng: number; // RNG state (uint32)
}

/** A fresh garden for a brand-new player. */
export function newGame(seed: number = RNG_SEED): GameState {
  return {
    dew: 0,
    plots: new Array(PLOT_COUNT).fill(0),
    unlocked: START_PLOTS,
    upgrades: new Array(UPGRADE_COUNT).fill(0),
    seedsBought: 0,
    stage: 1,
    earned: 0,
    maxStage: 1,
    maxStageEver: 1,
    grewTree: false,
    discovered: 0,
    sunCoins: 0,
    lifetimeCoins: 0,
    rebirths: 0,
    relics: freshRelics(),
    rng: seed >>> 0,
  };
}

function emptyPlots(s: GameState): number[] {
  const out: number[] = [];
  for (const i of unlockedPlots(s.unlocked)) if (s.plots[i] === 0) out.push(i);
  return out;
}

export function hasEmptyPlot(s: GameState): boolean {
  for (const i of unlockedPlots(s.unlocked)) if (s.plots[i] === 0) return true;
  return false;
}

// --- derived (effective) stats -----------------------------------------------
export interface UpgradeView {
  index: number;
  level: number;
  cost: number;
  atMax: boolean;
}

export interface Derived {
  passivePerSec: number; // current passive dew/sec (incl. stage multiplier)
  passiveBase: number; // passive dew/sec excluding the stage multiplier
  plantMult: number; // per-plant passive multiplier (incl. stage)
  stageMult: number;
  globalMult: number;
  tapBase: number; // dew per manual tap (pre-crit, pre-warmth)
  warmthPerTap: number; // extra dew added to each tap
  clickValue: number; // tapBase + warmthPerTap (shown as "per tap")
  critChance: number;
  critPower: number;
  expectedTap: number; // average tap value incl. crit + warmth
  autoRate: number; // auto taps/sec
  autoPerSec: number; // auto-tap dew/sec
  mergeBurstMult: number;
  seedCost: number;
  seedQualityChance: number;
  nextPlotCost: number; // Infinity when fully unlocked
  plotStep: number; // 0..6; which expansion step is next
  upgrades: UpgradeView[];
  goal: number;
  isBoss: boolean;
  bossReq: number; // 0 when not a boss stage
  bossMet: boolean;
  rebirthAvailable: boolean;
  rebirthCoins: number;
}

export function derive(s: GameState): Derived {
  const r = s.relics;
  const u = s.upgrades;
  const globalMult = 1 + LIFETIME_BONUS_PER_COIN * s.lifetimeCoins;
  const stageMult = 1 + STAGE_INCOME_PER_LEVEL * (s.stage - 1);

  // click (pot power line + dew-lens relic)
  const powerLv = u[U.power];
  const powerBase = (1 + powerLv) * Math.pow(2, Math.floor(powerLv / POT_POWER_DOUBLE_EVERY));
  const tapBase = powerBase * relicFx.lensMult(r[R.lens]) * globalMult;

  // crit
  const critChance = Math.min(
    CRIT_CHANCE_CAP,
    CRIT_CHANCE_PER_LEVEL * u[U.crit] + relicFx.cloverChance(r[R.clover]),
  );
  const critPower =
    CRIT_POWER_BASE + CRIT_POWER_PER_LEVEL * u[U.critPower] + relicFx.thunderPower(r[R.thunder]);

  // passive
  let raw = 0;
  for (const i of unlockedPlots(s.unlocked)) raw += incomeForLevel(s.plots[i]);
  const baseMult = (1 + FERT_PER_LEVEL * u[U.fert]) * relicFx.sunMult(r[R.sun]) * globalMult;
  const plantMult = baseMult * stageMult;
  const passiveBase = raw * baseMult;
  const passivePerSec = passiveBase * stageMult;

  // warmth (added to each tap) uses current passive/sec
  const warmthPerTap = passivePerSec * WARMTH_PER_LEVEL * u[U.warmth];
  const clickValue = tapBase + warmthPerTap;
  const expectedTap = tapBase * (1 + critChance * (critPower - 1)) + warmthPerTap;

  // auto tap
  const autoRate = Math.min(AUTO_TAP_CAP, AUTO_TAP_PER_LEVEL * u[U.auto] + relicFx.cloudRate(r[R.cloud]));
  const autoPerSec = autoRate * expectedTap;

  const mergeBurstMult = (1 + MERGE_BURST_PER_LEVEL * u[U.merge]) * relicFx.beeMult(r[R.bee]);
  const seedCost = seedCostFn(s.seedsBought, seedDiscount(r));
  const seedQualityChance = Math.min(SEED_QUALITY_CAP, SEED_QUALITY_PER_LEVEL * u[U.seed]);

  const plotStep = s.unlocked - START_PLOTS;
  const nextPlotCost = s.unlocked >= PLOT_COUNT ? Infinity : Math.ceil(plotCost(plotStep) * (1 - costDiscount(r)));

  const discount = costDiscount(r);
  const upgrades: UpgradeView[] = UPGRADES.map((def, i) => {
    const level = u[i];
    const atMax = level >= def.max;
    return { index: i, level, cost: atMax ? Infinity : upgradeCostFn(i, level, discount), atMax };
  });

  const goal = stageGoal(s.stage);
  const isBoss = isBossStage(s.stage);
  const bossReq = isBoss ? bossRequiredLevel(s.stage) : 0;
  const bossMet = bossSatisfied(s.stage, s.plots);
  const rebirthAvailable = s.maxStage >= REBIRTH_STAGE;
  const coins = rebirthCoins(s.maxStage, s.grewTree, r[R.lotus]);

  return {
    passivePerSec,
    passiveBase,
    plantMult,
    stageMult,
    globalMult,
    tapBase,
    warmthPerTap,
    clickValue,
    critChance,
    critPower,
    expectedTap,
    autoRate,
    autoPerSec,
    mergeBurstMult,
    seedCost,
    seedQualityChance,
    nextPlotCost,
    plotStep,
    upgrades,
    goal,
    isBoss,
    bossReq,
    bossMet,
    rebirthAvailable,
    rebirthCoins: coins,
  };
}

// --- earning / stage settlement ----------------------------------------------
export interface EarnInfo {
  stageAdvanced: number; // stages cleared by this earn
  chestDew: number; // bonus chest dew granted
}

/**
 * Add `amount` dew, credit it toward the stage goal, and clear as many stages as
 * possible. The chest reward is added on top (it does not itself count toward the
 * next stage, so clears cannot cascade off their own rewards).
 */
function earn(s: GameState, amount: number): { state: GameState; info: EarnInfo } {
  if (amount <= 0) return { state: s, info: { stageAdvanced: 0, chestDew: 0 } };
  const d = derive(s);
  const passiveBaseNoStage = d.passiveBase; // already excludes the stage multiplier
  const passiveAtStage = (stage: number) =>
    passiveBaseNoStage * (1 + STAGE_INCOME_PER_LEVEL * (stage - 1));

  const settle = settleStages(
    s.stage,
    s.earned + amount,
    s.maxStage,
    s.plots,
    passiveAtStage,
  );
  const dew = s.dew + amount + settle.chestDew;
  const state: GameState = {
    ...s,
    dew,
    earned: settle.earned,
    stage: settle.stage,
    maxStage: settle.maxStage,
    maxStageEver: Math.max(s.maxStageEver, settle.maxStage),
  };
  return { state, info: { stageAdvanced: settle.advanced, chestDew: settle.chestDew } };
}

// --- actions -----------------------------------------------------------------
export interface TapResult {
  state: GameState;
  gained: number;
  crit: boolean;
  info: EarnInfo;
}

/** Tap the pot: earn click dew, possibly a crit, plus the warmth bonus. */
export function tap(s: GameState): TapResult {
  const d = derive(s);
  const { rng, value } = nextRng(s.rng);
  const crit = value < d.critChance;
  const gained = d.tapBase * (crit ? d.critPower : 1) + d.warmthPerTap;
  const { state, info } = earn({ ...s, rng }, gained);
  return { state, gained, crit, info };
}

export interface BuyResult {
  state: GameState;
  ok: boolean;
  plot: number;
  cost: number;
  level: number; // level of the seed planted (1 or 2)
  info: EarnInfo;
}

/** Buy a seed: spend dew, drop a plant on a random empty plot. */
export function buySeed(s: GameState): BuyResult {
  const d = derive(s);
  const empties = emptyPlots(s);
  if (s.dew < d.seedCost || empties.length === 0) {
    return { state: s, ok: false, plot: -1, cost: d.seedCost, level: 0, info: EMPTY_INFO };
  }
  const pick = pickIndex(s.rng, empties.length);
  const plot = empties[pick.index];
  // seed quality: a chance the seed arrives at level 2 already
  const roll = nextRng(pick.rng);
  const rng = roll.rng;
  const level = roll.value < d.seedQualityChance ? 2 : 1;
  const plots = s.plots.slice();
  plots[plot] = level;
  const next: GameState = {
    ...s,
    dew: s.dew - d.seedCost,
    seedsBought: s.seedsBought + 1,
    plots,
    rng,
    discovered: Math.max(s.discovered, level),
  };
  return { state: next, ok: true, plot, cost: d.seedCost, level, info: EMPTY_INFO };
}

const EMPTY_INFO: EarnInfo = { stageAdvanced: 0, chestDew: 0 };

export interface MergeResult {
  state: GameState;
  ok: boolean;
  newLevel: number;
  plot: number;
  isNewMax: boolean;
  burst: number; // merge-burst dew granted
  freeSeed: boolean; // ladybug granted a free seed
  info: EarnInfo;
}

/** Merge plant `a` into `b` (same level 1..8). Grants a merge-burst of dew. */
export function merge(s: GameState, a: number, b: number): MergeResult {
  const la = s.plots[a];
  const lb = s.plots[b];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || !isPlotUnlocked(a, s.unlocked) || !isPlotUnlocked(b, s.unlocked) || a === b || la === 0 || la !== lb || la >= MAX_LEVEL) {
    return {
      state: s, ok: false, newLevel: 0, plot: -1, isNewMax: false, burst: 0,
      freeSeed: false, info: EMPTY_INFO,
    };
  }
  const d = derive(s);
  const newLevel = la + 1;
  const plots = s.plots.slice();
  plots[b] = newLevel;
  plots[a] = 0;
  const isNewMax = newLevel > s.discovered;

  let rng = s.rng;
  // ladybug: chance to drop a free level-1 seed on an empty plot
  let freeSeed = false;
  const ladybugChance = relicFx.ladybugChance(s.relics[R.ladybug]);
  if (ladybugChance > 0) {
    const roll = nextRng(rng);
    rng = roll.rng;
    if (roll.value < ladybugChance) {
      const empties: number[] = [];
      for (const i of unlockedPlots(s.unlocked)) if (plots[i] === 0) empties.push(i);
      if (empties.length) {
        const pick = pickIndex(rng, empties.length);
        rng = pick.rng;
        plots[empties[pick.index]] = 1;
        freeSeed = true;
      }
    }
  }

  const grewTree = s.grewTree || newLevel >= MAX_LEVEL;
  const mid: GameState = {
    ...s,
    plots,
    rng,
    grewTree,
    discovered: Math.max(s.discovered, newLevel),
  };
  // merge burst: MERGE_BURST_SECONDS of the new plant's income, boosted by relics
  const burst = MERGE_BURST_SECONDS * incomeForLevel(newLevel) * d.plantMult * d.mergeBurstMult;
  const { state, info } = earn(mid, burst);
  return { state, ok: true, newLevel, plot: b, isNewMax, burst, freeSeed, info };
}

export interface MoveResult {
  state: GameState;
  ok: boolean;
}

/** Move the plant on `a` to the empty, unlocked plot `b`. */
export function move(s: GameState, a: number, b: number): MoveResult {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || !isPlotUnlocked(a, s.unlocked) || a === b || !isPlotUnlocked(b, s.unlocked) || s.plots[a] === 0 || s.plots[b] !== 0) {
    return { state: s, ok: false };
  }
  const plots = s.plots.slice();
  plots[b] = plots[a];
  plots[a] = 0;
  return { state: { ...s, plots }, ok: true };
}

// --- tick (passive + auto-tap) -----------------------------------------------
/** Advance passive income + auto-tap by `dtSec` seconds. */
export function tick(s: GameState, dtSec: number): { state: GameState; info: EarnInfo } {
  if (dtSec <= 0) return { state: s, info: EMPTY_INFO };
  const d = derive(s);
  const amount = (d.passivePerSec + d.autoPerSec) * dtSec;
  return earn(s, amount);
}

/** Dew earned while away: min(elapsed, cap) × passive/sec × offline rate. */
export function offlineEarnings(s: GameState, elapsedSec: number): number {
  const d = derive(s);
  const moon = s.relics[R.moon];
  const sec = Math.max(0, Math.min(elapsedSec, relicFx.offlineCapSec(moon)));
  return d.passivePerSec * sec * relicFx.offlineRate(moon);
}

/** Apply offline earnings onto the state (credited toward the current stage). */
export function applyOffline(s: GameState, elapsedSec: number): { state: GameState; earned: number } {
  const earnedAmt = offlineEarnings(s, elapsedSec);
  if (earnedAmt < 1) return { state: s, earned: 0 };
  return { state: earn(s, earnedAmt).state, earned: earnedAmt };
}
