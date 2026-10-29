// Tap Garden v2 — every tunable number and per-line formula lives here, so the
// economy can be balanced (and the simulation re-tuned) without touching logic.
// All values are plain doubles; the UI formats them with compact notation.
//
// The simulation (scripts/sim-economy.mjs) tunes the CONSTANTS below until the
// targets in PLAN §3.6 are met; the final adopted values are mirrored back into
// PLAN.md with a short note.

export const PLOT_COUNT = 16; // 4 × 4 garden grid
export const START_PLOTS = 9; // 3 × 3 open at the start of each run
export const MAX_LEVEL = 9; // level-9 Golden World Tree is the top tier
export const REBIRTH_STAGE = 10; // first rebirth unlocks at this stage

// Row-major positions: begin with a true 3×3 garden, then open the right edge
// and bottom row. `unlocked` is a count, never a row-major index boundary.
export const PLOT_UNLOCK_ORDER = [0, 1, 2, 4, 5, 6, 8, 9, 10, 3, 7, 11, 12, 13, 14, 15];
export function unlockedPlots(count: number): number[] { return PLOT_UNLOCK_ORDER.slice(0, count); }
export function isPlotUnlocked(index: number, count: number): boolean {
  const rank = PLOT_UNLOCK_ORDER.indexOf(index);
  return rank >= 0 && rank < count;
}

// Fixed RNG seed so seed placement / crits / draws are deterministic in tests.
export const RNG_SEED = 0x9e3779b9;

// How often the game autosaves while playing (ms).
export const SAVE_INTERVAL_MS = 5000;
export const OFFLINE_MIN_SEC = 30; // only greet with the offline dialog past this gap

// --- passive income ----------------------------------------------------------
// A level-L plant makes INCOME_BASE × INCOME_GROWTH^(L−1) dew per second (before multipliers).
export const INCOME_BASE = 0.5;
export const INCOME_GROWTH = 2.5;
export const AUTO_MERGE_STAGE = 2;
export function incomeForLevel(level: number): number {
  return level > 0 ? INCOME_BASE * Math.pow(INCOME_GROWTH, level - 1) : 0;
}

// --- seeds -------------------------------------------------------------------
// Seed price grows 6% through 100 seeds, then linearly (+3% of cap price/seed).
export const SEED_BASE_COST = 10;
export const SEED_GROWTH = 1.06;
export const SEED_SOFT_CAP = 100;
export function seedCost(seedsBought: number, discount: number): number {
  return Math.ceil(SEED_BASE_COST * Math.pow(SEED_GROWTH, Math.min(seedsBought, SEED_SOFT_CAP)) * (1 + Math.max(0, seedsBought - SEED_SOFT_CAP) * 0.03) * (1 - discount));
}

// --- plot expansion (upgrade line #9) ----------------------------------------
// Unlock the next plot (START_PLOTS→PLOT_COUNT, i.e. 7 steps): 200 × 8^k dew.
export const PLOT_BASE_COST = 200;
export const PLOT_GROWTH = 8;
export function plotCost(stepK: number): number {
  return Math.ceil(PLOT_BASE_COST * Math.pow(PLOT_GROWTH, stepK));
}

// --- the 8 numeric pot-upgrade lines -----------------------------------------
// base × growth^level × (1 − cost discount); each has a level cap (Infinity = none).
export interface UpgradeDef {
  key: string;
  base: number;
  growth: number;
  max: number;
}

export const UPGRADES: UpgradeDef[] = [
  { key: 'power', base: 15, growth: 1.15, max: Infinity }, // Pot Power
  { key: 'warmth', base: 500, growth: 1.25, max: 100 }, // Pot Warmth
  { key: 'crit', base: 300, growth: 1.35, max: 40 }, // Crit Chance
  { key: 'critPower', base: 400, growth: 1.3, max: 80 }, // Crit Power
  { key: 'auto', base: 200, growth: 1.28, max: 40 }, // Auto Tap
  { key: 'fert', base: 100, growth: 1.2, max: Infinity }, // Fertilizer
  { key: 'merge', base: 250, growth: 1.22, max: 100 }, // Merge Burst
  { key: 'seed', base: 1000, growth: 1.5, max: 12 }, // Seed Quality
];
export const UPGRADE_COUNT = UPGRADES.length;
export const U = {
  power: 0,
  warmth: 1,
  crit: 2,
  critPower: 3,
  auto: 4,
  fert: 5,
  merge: 6,
  seed: 7,
} as const;

export function upgradeCost(index: number, level: number, discount: number): number {
  const def = UPGRADES[index];
  return Math.ceil(def.base * Math.pow(def.growth, level) * (1 - discount));
}

// --- upgrade effect numbers (kept here so balancing is one file) --------------
export const POT_POWER_DOUBLE_EVERY = 25; // Pot Power doubles every N levels
export const WARMTH_PER_LEVEL = 0.002; // +0.2% of passive/sec added per tap, per level
export const CRIT_CHANCE_PER_LEVEL = 0.01; // +1% crit chance / level
export const CRIT_CHANCE_CAP = 0.5; // combined crit chance cap
export const CRIT_POWER_BASE = 3;
export const CRIT_POWER_PER_LEVEL = 0.25; // +0.25× crit multiplier / level
export const AUTO_TAP_PER_LEVEL = 0.5; // +0.5 taps/sec / level
export const AUTO_TAP_CAP = 30; // taps/sec cap (incl. relics)
export const FERT_PER_LEVEL = 0.15; // passive ×(1 + 0.15 L)
export const MERGE_BURST_PER_LEVEL = 0.25; // merge burst ×(1 + 0.25 L)
export const MERGE_BURST_SECONDS = 5; // merge burst = N sec of the new plant
export const SEED_QUALITY_PER_LEVEL = 0.05; // chance a bought seed is level 2
export const SEED_QUALITY_CAP = 0.6;

// Global prestige bonus: lifetime sun coins give +5% to click & passive each.
export const LIFETIME_BONUS_PER_COIN = 0.05;

// --- stages ------------------------------------------------------------------
// Stage n goal (dew earned this stage): STAGE_BASE × STAGE_GROWTH^(n−1).
export const STAGE_BASE = 16000;
export const STAGE_GROWTH = 2.0;
export const STAGE_INCOME_PER_LEVEL = 0.1; // passive ×(1 + 0.10 (stage−1))
export const BOSS_EVERY = 5; // every 5th stage is a boss
export const BOSS_REQ_BASE = 2; // boss n needs a plant of level ≥ min(9, 2 + floor(n/5))
export const CHEST_SECONDS = 30; // stage-clear chest = N sec of passive income
export function stageGoal(stage: number): number {
  return STAGE_BASE * Math.pow(STAGE_GROWTH, stage - 1);
}
export function isBossStage(stage: number): boolean {
  return stage % BOSS_EVERY === 0;
}
export function bossRequiredLevel(stage: number): number {
  return Math.min(MAX_LEVEL, BOSS_REQ_BASE + Math.floor(stage / BOSS_EVERY));
}

// --- rebirth / sun coins -----------------------------------------------------
export const REBIRTH_COIN_OFFSET = 8; // coins = MULT × (maxStage − 8)^EXP × lotus …
export const REBIRTH_COIN_EXP = 1.6;
export const REBIRTH_COIN_MULT = 10; // scales coin income so relics are reachable
export const REBIRTH_TREE_BONUS = 5; // + this if a level-9 tree grew this run
export function rebirthCoins(maxStage: number, grewTree: boolean, lotusLevel: number): number {
  if (maxStage < REBIRTH_STAGE) return 0;
  const base =
    REBIRTH_COIN_MULT * Math.pow(maxStage - REBIRTH_COIN_OFFSET, REBIRTH_COIN_EXP) * (1 + LOTUS_PER_LEVEL * lotusLevel);
  return Math.floor(base) + (grewTree ? REBIRTH_TREE_BONUS : 0);
}

// --- offline earnings --------------------------------------------------------
export const OFFLINE_CAP_SEC = 2 * 60 * 60; // base 2 h cap
export const OFFLINE_RATE = 0.5; // base 50% of passive while away
export const OFFLINE_RATE_CAP = 1; // offline rate never exceeds 100%

// --- relics (PLAN §3.5) ------------------------------------------------------
// Sun-coin prices: a random draw, a targeted buy-unlock, and the per-relic
// upgrade cost ceil(c0 × RELIC_COST_GROWTH^level).
export const DRAW_COST = 8;
export const UNLOCK_COST = 20;
export const RELIC_COST_GROWTH = 1.5;

export interface RelicDef {
  key: string; // also the i18n key and the icon suffix: icon_relic_<key>.png
  c0: number; // base upgrade cost (sun coins)
  max: number; // max level
}

// Order matches the icon numbering in PLAN §3.5 (1..12).
export const RELICS: RelicDef[] = [
  { key: 'lens', c0: 3, max: 50 }, // Dew Lens — click dew ×(1 + 0.10 L)
  { key: 'sun', c0: 3, max: 50 }, // Sun Pendant — passive ×(1 + 0.15 L)
  { key: 'moon', c0: 4, max: 30 }, // Moon Watch — offline rate +3% L, cap +20 min L
  { key: 'bee', c0: 4, max: 40 }, // Bee Charm — merge burst ×(1 + 0.25 L)
  { key: 'clover', c0: 5, max: 30 }, // Lucky Clover — crit chance +1% L
  { key: 'thunder', c0: 5, max: 40 }, // Thunder Seed — crit power +0.15 L
  { key: 'trowel', c0: 6, max: 20 }, // Golden Trowel — seed price −3% L (≤ 60%)
  { key: 'cloud', c0: 6, max: 25 }, // Rain Cloud — auto tap +0.2/s L
  { key: 'lotus', c0: 8, max: 30 }, // Rebirth Lotus — rebirth coins ×(1 + 0.10 L)
  { key: 'ladybug', c0: 6, max: 17 }, // Ladybug — 3% L free seed on merge (≤ 50%)
  { key: 'can', c0: 7, max: 25 }, // Watering Can — dew upgrade cost −2% L (≤ 50%)
  { key: 'acorn', c0: 5, max: 30 }, // Ancient Acorn — 50 × 1.6^L dew at run start
];
export const RELIC_COUNT = RELICS.length;
export const R = {
  lens: 0,
  sun: 1,
  moon: 2,
  bee: 3,
  clover: 4,
  thunder: 5,
  trowel: 6,
  cloud: 7,
  lotus: 8,
  ladybug: 9,
  can: 10,
  acorn: 11,
} as const;

export function relicUpgradeCost(index: number, level: number): number {
  return Math.ceil(RELICS[index].c0 * Math.pow(RELIC_COST_GROWTH, level));
}

// Per-level relic effect numbers.
export const LENS_PER_LEVEL = 0.1; // click ×(1 + 0.10 L)
export const SUN_PER_LEVEL = 0.15; // passive ×(1 + 0.15 L)
export const MOON_RATE_PER_LEVEL = 0.03; // +3% offline rate / level
export const MOON_CAP_SEC_PER_LEVEL = 20 * 60; // +20 min offline cap / level
export const BEE_PER_LEVEL = 0.25; // merge burst ×(1 + 0.25 L)
export const CLOVER_PER_LEVEL = 0.01; // +1% crit chance / level
export const THUNDER_PER_LEVEL = 0.15; // +0.15× crit power / level
export const TROWEL_PER_LEVEL = 0.03; // −3% seed price / level
export const TROWEL_CAP = 0.6;
export const CLOUD_PER_LEVEL = 0.2; // +0.2 auto taps/sec / level
export const LOTUS_PER_LEVEL = 0.1; // rebirth coins ×(1 + 0.10 L)
export const LADYBUG_PER_LEVEL = 0.03; // +3% free-seed chance per merge / level
export const LADYBUG_CAP = 0.5;
export const CAN_PER_LEVEL = 0.02; // −2% dew upgrade cost / level
export const CAN_CAP = 0.5;
export const ACORN_BASE = 50; // run-start dew = 50 × 1.6^L
export const ACORN_GROWTH = 1.6;
