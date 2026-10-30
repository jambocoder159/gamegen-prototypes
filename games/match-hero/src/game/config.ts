export const REBIRTH_MIN_FLOOR = 10;
export const REBIRTH = {
  base: 0.6,
  offset: 5,
  power: 1.35,
  crownBonus: 0.1,
} as const;
export const CONFIG = {
  size: 6,
  enemyHp: 4600,
  hpGrowth: 1.06,
  enemyInterval: 2.7,
  bossHp: 6,
  bossInterval: 2.2,
  expectedHpBase: 100,
  expectedHpPerFloor: 0.5,
  normalDamageBase: 0.04,
  normalDamageGrowth: 0.002,
  bossDamageBase: 0.12,
  bossDamageGrowth: 0.003,
  deathSeconds: 0.45,
  emptySeconds: 0.06,
  entrySeconds: 0.4,
  killGold: 8,
  killGrowth: 1.16,
  autoGold: 40,
  autoSp: 1,
  floorGold: 15,
  spMax: 100,
  comboStep: 0.25,
  skills: {
    fireball: { cost: 30, cooldown: 2 },
    heal: { cost: 40, cooldown: 2 },
    haste: { cost: 25, cooldown: 8 },
  },
  upgrades: {
    atk: { base: 20, growth: 1.2, cap: 1000 },
    speed: { base: 60, growth: 1.28, cap: 50 },
    crit: { base: 80, growth: 1.3, cap: 55 },
    hp: { base: 30, growth: 1.22, cap: 1000 },
    power: { base: 100, growth: 1.3, cap: 60 },
    gold: { base: 70, growth: 1.28, cap: 80 },
    focus: { base: 150, growth: 1.35, cap: 40 },
  },
} as const;
export const RELICS = {
  sword: { base: 1, growth: 1.35, cap: 100, step: 0.2, icon: "sword" },
  feather: { base: 1, growth: 1.4, cap: 40, step: 0.03, icon: "relic_feather" },
  ring: { base: 1, growth: 1.4, cap: 100, step: 0.1, icon: "relic_ring" },
  amulet: { base: 1, growth: 1.4, cap: 100, step: 0.1, icon: "heart" },
  tome: { base: 1, growth: 1.35, cap: 80, step: 0.08, icon: "upgrade" },
  core: { base: 2, growth: 1.45, cap: 60, step: 0.08, icon: "sp" },
  badge: { base: 2, growth: 1.5, cap: 40, step: 0.005, icon: "danger" },
  shield: { base: 1, growth: 1.4, cap: 30, step: 0.02, icon: "shield" },
  boots: { base: 1, growth: 1.35, cap: 20, step: 0.5, icon: "haste" },
  crown: { base: 3, growth: 1.6, cap: 50, step: 0.1, icon: "rebirth" },
  flame: { base: 1, growth: 1.4, cap: 40, step: 0.15, icon: "fire" },
} as const;
export type Relic = keyof typeof RELICS;
export type Upgrade = keyof typeof CONFIG.upgrades;
export type Skill = keyof typeof CONFIG.skills;
