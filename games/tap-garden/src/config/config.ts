// Tap Garden — every tunable number lives here, so balancing never touches logic.
// Dew is a floating value internally; the UI formats it with compact notation.

export const PLOT_COUNT = 16; // 4 × 4 garden grid
export const MAX_LEVEL = 9; // level-9 Golden World Tree is the top tier

// Tapping the magic pot. Power starts at 1 and rises by 1 per upgrade.
export const TAP_POWER_BASE = 1;
export function tapPowerFor(tapLevel: number): number {
  return TAP_POWER_BASE + (tapLevel - 1);
}

// Seed price: 10 × 1.15^(seeds already bought), rounded up.
export const SEED_BASE_COST = 10;
export const SEED_GROWTH = 1.15;
export function seedCost(seedsBought: number): number {
  return Math.ceil(SEED_BASE_COST * Math.pow(SEED_GROWTH, seedsBought));
}

// Tap-power upgrade price: 25 × 1.6^(current level − 1), rounded up.
export const UPGRADE_BASE_COST = 25;
export const UPGRADE_GROWTH = 1.6;
export function upgradeCost(tapLevel: number): number {
  return Math.ceil(UPGRADE_BASE_COST * Math.pow(UPGRADE_GROWTH, tapLevel - 1));
}

// Passive income: a level-L plant makes 0.5 × 2^(L−1) dew per second.
export const INCOME_BASE = 0.5;
export function incomeForLevel(level: number): number {
  return level > 0 ? INCOME_BASE * Math.pow(2, level - 1) : 0;
}

// Offline earnings: elapsed (capped at 2 h) × income/sec × 50%.
export const OFFLINE_CAP_SEC = 2 * 60 * 60;
export const OFFLINE_RATE = 0.5;
export const OFFLINE_MIN_SEC = 30; // only greet with a dialog past this gap

// How often the game autosaves while playing.
export const SAVE_INTERVAL_MS = 5000;

// Fixed seed so seed-placement is deterministic (repeatable demo + tests).
export const RNG_SEED = 0x9e3779b9;
