import {
  CONFIG as C,
  RELICS,
  REBIRTH,
  REBIRTH_MIN_FLOOR,
  type Relic,
  type Upgrade,
  type Skill,
} from "./config";
export const GEMS = ["sword", "mana", "heart", "coin", "fire", "star"] as const;
export type Gem = (typeof GEMS)[number];
export type Rng = () => number;
export const seeded =
  (seed: number): Rng =>
  () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
export const adjacent = (a: number, b: number) =>
  a >= 0 &&
  b >= 0 &&
  a < 36 &&
  b < 36 &&
  Math.abs((a % 6) - (b % 6)) +
    Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) ===
    1;
export function matches(board: Gem[]): number[][] {
  const groups: number[][] = [];
  for (let axis = 0; axis < 2; axis++)
    for (let line = 0; line < 6; line++) {
      let run: number[] = [];
      for (let pos = 0; pos <= 6; pos++) {
        const i = axis ? pos * 6 + line : line * 6 + pos;
        if (pos < 6 && (!run.length || board[i] === board[run[0]])) run.push(i);
        else {
          if (run.length >= 3) groups.push(run);
          run = pos < 6 ? [i] : [];
        }
      }
    }
  return groups;
}
export function possibleMove(board: Gem[]): [number, number] | null {
  for (let a = 0; a < 36; a++)
    for (const b of [a + 1, a + 6]) {
      if (!adjacent(a, b)) continue;
      if (board[a] === "star" || board[b] === "star") return [a, b];
      const copy = [...board];
      [copy[a], copy[b]] = [copy[b], copy[a]];
      if (matches(copy).length) return [a, b];
    }
  return null;
}
export function createBoard(rng: Rng): Gem[] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const b: Gem[] = [];
    for (let i = 0; i < 36; i++) {
      const options = GEMS.slice(0, 5).filter(
        (g) =>
          !(i % 6 >= 2 && b[i - 1] === g && b[i - 2] === g) &&
          !(i >= 12 && b[i - 6] === g && b[i - 12] === g),
      );
      b.push(options[Math.floor(rng() * options.length)]);
    }
    if (possibleMove(b)) return b;
  }
  throw new Error("RNG could not produce playable board");
}
export interface Cascade {
  cleared: number[];
  gems: Gem[];
  stars: number[];
  before: Gem[];
  after: Gem[];
  combo: number;
}
export function swap(board: Gem[], a: number, b: number, rng: Rng) {
  const fail = {
    valid: false,
    board,
    cascades: [] as Cascade[],
    reshuffled: false,
  };
  if (!adjacent(a, b)) return fail;
  let next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  let groups = matches(next);
  let triggers = [a, b].filter((i) => next[i] === "star");
  if (!groups.length && !triggers.length) return fail;
  const cascades: Cascade[] = [];
  for (
    let depth = 1;
    depth <= 100 && (groups.length || triggers.length);
    depth++
  ) {
    const clear = new Set(groups.flat()),
      stars = groups
        .filter((g) => g.length >= 4)
        .map((g) => (g.includes(b) ? b : g[0]));
    triggers.forEach((i) => clear.add(i));
    const exploded = new Set<number>();
    for (;;) {
      const ts = [...clear].filter(
        (i) => next[i] === "star" && !exploded.has(i),
      );
      if (!ts.length) break;
      for (const i of ts) {
        exploded.add(i);
        for (let j = 0; j < 36; j++)
          if (
            Math.abs((i % 6) - (j % 6)) <= 1 &&
            Math.abs(Math.floor(i / 6) - Math.floor(j / 6)) <= 1
          )
            clear.add(j);
      }
    }
    const before = [...next],
      gems = [...clear].map((i) => next[i]);
    stars.forEach((i) => {
      clear.delete(i);
      next[i] = "star";
    });
    const cleared = [...clear];
    for (let col = 0; col < 6; col++) {
      const kept: Gem[] = [];
      for (let row = 5; row >= 0; row--)
        if (!clear.has(row * 6 + col)) kept.push(next[row * 6 + col]);
      for (let row = 5; row >= 0; row--)
        next[row * 6 + col] = kept[5 - row] ?? GEMS[Math.floor(rng() * 5)];
    }
    cascades.push({
      cleared,
      gems,
      stars,
      before,
      after: [...next],
      combo: 1 + C.comboStep * (depth - 1),
    });
    groups = matches(next);
    triggers = [];
  }
  const reshuffled = !possibleMove(next) || matches(next).length > 0;
  if (reshuffled) next = createBoard(rng);
  return { valid: true, board: next, cascades, reshuffled };
}
export type Levels = Record<Upgrade, number>;
export const emptyLevels = (): Levels => ({
  atk: 0,
  speed: 0,
  crit: 0,
  hp: 0,
  power: 0,
  gold: 0,
  focus: 0,
});
export type RelicLevels = Partial<Record<Relic, number>>;
export function relicEffects(r: RelicLevels = {}) {
  const bonus = (k: Relic) => RELICS[k].step * (r[k] ?? 0);
  return {
    attack: 1 + bonus("sword"),
    speed: 1 + bonus("feather"),
    gold: 1 + bonus("ring"),
    hp: 1 + bonus("amulet"),
    power: 1 + bonus("tome"),
    focus: 1 + bonus("core"),
    crit: bonus("badge"),
    guard: 1 - bonus("shield"),
    boots: Math.floor(bonus("boots")),
    shards: 1 + bonus("crown"),
    burn: 1 + bonus("flame"),
  };
}
// Lifetime earnings keep their bonus after shards are spent on relics.
export const shardBonus = (totalShards: number) =>
  Math.min(1, Math.max(0, totalShards) * 0.02);
export function stats(l: Levels, r: RelicLevels = {}, totalShards = 0) {
  const b = relicEffects(r),
    permanent = 1 + shardBonus(totalShards);
  return {
    atk: 5 * (1 + 0.25 * l.atk) * 1.05 ** l.atk * b.attack * permanent,
    interval: Math.max(0.25, 1 / (1 + 0.04 * l.speed)) / b.speed,
    crit: Math.min(0.6, 0.05 + 0.01 * l.crit + b.crit),
    hp: 100 * (1 + 0.2 * l.hp) * b.hp,
    power: (1 + 0.12 * l.power) * b.power,
    gold: (1 + 0.1 * l.gold) * b.gold * permanent,
    focus: (1 + 0.05 * l.focus) * b.focus,
  };
}
export const upgradeCost = (key: Upgrade, level: number) =>
  level >= C.upgrades[key].cap
    ? Infinity
    : Math.ceil(C.upgrades[key].base * C.upgrades[key].growth ** level);
export const relicCost = (key: Relic, level: number) =>
  level >= RELICS[key].cap
    ? Infinity
    : Math.ceil(RELICS[key].base * RELICS[key].growth ** level);
export function enemy(floor: number) {
  const boss = floor % 5 === 0,
    expectedHp = C.expectedHpBase + C.expectedHpPerFloor * (floor - 1);
  return {
    hp: C.enemyHp * C.hpGrowth ** (floor - 1) * (boss ? C.bossHp : 1),
    atk:
      expectedHp *
      (boss
        ? Math.min(0.18, C.bossDamageBase + C.bossDamageGrowth * floor)
        : Math.min(0.08, C.normalDamageBase + C.normalDamageGrowth * floor)),
    interval: boss ? C.bossInterval : C.enemyInterval,
  };
}
export type EnemyPhase = "entering" | "active" | "dying" | "empty";
export interface Run {
  version: 2;
  board: Gem[];
  levels: Levels;
  gold: number;
  totalGold: number;
  floor: number;
  best: number;
  bestEver: number;
  shards: number;
  totalShards: number;
  rebirths: number;
  relics: RelicLevels;
  wave: number;
  enemyHp: number;
  enemyMaxHp: number;
  hp: number;
  sp: number;
  autoTimer: number;
  enemyTimer: number;
  enemyAttacks: number;
  enemyId: number;
  enemyPhase: EnemyPhase;
  phaseTime: number;
  burn: number;
  burnTimer: number;
  haste: number;
  cooldowns: Record<Skill, number>;
  defeated: boolean;
  elapsed: number;
  autoDamage: number;
  matchDamage: number;
  lastDamage: number;
  combo: number;
  kills: number;
}
export type CombatEvent = {
  id: number;
  type:
    | "auto"
    | "burn"
    | "hurt"
    | "kill"
    | "floor"
    | "match"
    | "heal"
    | "gold"
    | "sp"
    | "fireball"
    | "haste"
    | "rebirth";
  amount: number;
  crit?: boolean;
  heavy?: boolean;
  gem?: Gem;
  combo?: number;
};
const eventQueues = new WeakMap<Run, CombatEvent[]>();
let eventId = 0;
function emit(s: Run, e: Omit<CombatEvent, "id">) {
  const q = eventQueues.get(s) ?? [];
  q.push({ ...e, id: ++eventId });
  eventQueues.set(s, q.slice(-32));
}
export function drainEvents(s: Run) {
  const q = eventQueues.get(s) ?? [];
  eventQueues.set(s, []);
  return q;
}
export function newRun(rng: Rng, floor = 1): Run {
  return {
    version: 2,
    board: createBoard(rng),
    levels: emptyLevels(),
    gold: 0,
    totalGold: 0,
    floor,
    best: floor,
    bestEver: floor,
    shards: 0,
    totalShards: 0,
    rebirths: 0,
    relics: {},
    wave: 1,
    enemyHp: enemy(floor).hp,
    enemyMaxHp: enemy(floor).hp,
    hp: 100,
    sp: 0,
    autoTimer: 0,
    enemyTimer: 0,
    enemyAttacks: 0,
    enemyId: 1,
    enemyPhase: "entering",
    phaseTime: 0,
    burn: 0,
    burnTimer: 0,
    haste: 0,
    cooldowns: { fireball: 0, heal: 0, haste: 0 },
    defeated: false,
    elapsed: 0,
    autoDamage: 0,
    matchDamage: 0,
    lastDamage: 0,
    combo: 0,
    kills: 0,
  };
}
export function gainGold(s: Run, n: number) {
  s.gold += n;
  s.totalGold += n;
}
export function damage(s: Run, n: number, source: "auto" | "match") {
  if (s.enemyPhase !== "active" || s.defeated) return false;
  s[source === "auto" ? "autoDamage" : "matchDamage"] += n;
  s.enemyHp = Math.max(0, s.enemyHp - n);
  if (s.enemyHp > 0) return true;
  const st = stats(s.levels, s.relics, s.totalShards);
  gainGold(
    s,
    C.killGold *
      C.killGrowth ** (s.floor - 1) *
      (s.floor % 5 === 0 ? 5 : 1) *
      st.gold,
  );
  s.kills++;
  s.enemyPhase = "dying";
  s.phaseTime = 0;
  s.enemyTimer = 0;
  s.burn = 0;
  emit(s, { type: "kill", amount: 0 });
  return true;
}
function advance(s: Run) {
  const st = stats(s.levels, s.relics, s.totalShards);
  if (s.floor % 5 === 0 || s.wave === 3) {
    gainGold(s, C.floorGold * s.floor * st.gold);
    s.floor++;
    s.best = Math.max(s.best, s.floor);
    s.bestEver = Math.max(s.bestEver, s.best);
    s.wave = 1;
    s.hp = Math.min(st.hp, s.hp + st.hp * 0.25);
    emit(s, { type: "floor", amount: s.floor });
  } else s.wave++;
  s.enemyId++;
  s.enemyHp = enemy(s.floor).hp;
  s.enemyMaxHp = s.enemyHp;
  s.enemyTimer = 0;
  s.enemyAttacks = 0;
  s.autoTimer = 0;
  s.burn = 0;
  s.burnTimer = 0;
  s.enemyPhase = "entering";
  s.phaseTime = 0;
}
export const heavyAttack = (s: Run) =>
  s.floor % 5 === 0 && (s.enemyAttacks + 1) % 3 === 0;
export const chargeDuration = (s: Run) =>
  enemy(s.floor).interval * (heavyAttack(s) ? 1.5 : 1);
export const chargeProgress = (s: Run) =>
  s.enemyPhase === "active" ? Math.min(1, s.enemyTimer / chargeDuration(s)) : 0;
export function tick(s: Run, dt: number, rng: Rng) {
  if (s.defeated || dt <= 0) return;
  const st = stats(s.levels, s.relics, s.totalShards);
  s.elapsed += dt;
  for (const k of Object.keys(s.cooldowns) as Skill[])
    s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
  const interval = st.interval / (s.haste > 0 ? 2 : 1);
  s.haste = Math.max(0, s.haste - dt);
  if (s.enemyPhase !== "active") {
    s.phaseTime += dt;
    const duration =
      s.enemyPhase === "dying"
        ? C.deathSeconds
        : s.enemyPhase === "empty"
          ? C.emptySeconds
          : C.entrySeconds;
    if (s.phaseTime + 1e-9 >= duration) {
      if (s.enemyPhase === "dying") {
        s.enemyPhase = "empty";
        s.phaseTime = 0;
      } else if (s.enemyPhase === "empty") advance(s);
      else {
        s.enemyPhase = "active";
        s.phaseTime = 0;
      }
    }
    return;
  }
  s.autoTimer += dt;
  s.enemyTimer += dt;
  while (s.autoTimer + 1e-9 >= interval && s.enemyPhase === "active") {
    s.autoTimer = Math.max(0, s.autoTimer - interval);
    const crit = rng() < st.crit,
      amount = st.atk * (crit ? 2 : 1);
    damage(s, amount, "auto");
    emit(s, { type: "auto", amount, crit });
    gainGold(s, C.autoGold * st.gold);
    s.sp = Math.min(100, s.sp + C.autoSp * st.focus);
  }
  if (s.enemyPhase !== "active") return;
  if (s.burn > 0) {
    s.burn = Math.max(0, s.burn - dt);
    s.burnTimer += dt;
    if (s.burnTimer >= 1) {
      s.burnTimer -= 1;
      const amount = 0.2 * st.atk * relicEffects(s.relics).burn;
      damage(s, amount, "match");
      emit(s, { type: "burn", amount });
    }
  }
  if (s.enemyPhase === "active" && s.enemyTimer + 1e-9 >= chargeDuration(s)) {
    const heavy = heavyAttack(s),
      amount =
        enemy(s.floor).atk * relicEffects(s.relics).guard * (heavy ? 2 : 1);
    s.enemyTimer = 0;
    s.enemyAttacks++;
    s.hp -= amount;
    emit(s, { type: "hurt", amount, heavy });
  }
  if (s.hp <= 0) {
    s.defeated = true;
    s.floor = Math.floor((s.floor - 1) / 5) * 5 + 1;
    s.wave = 1;
    s.enemyHp = enemy(s.floor).hp;
    s.enemyMaxHp = s.enemyHp;
    s.hp = st.hp;
    s.sp = 0;
    s.burn = 0;
    s.haste = 0;
    s.autoTimer = 0;
    s.enemyTimer = 0;
    s.enemyAttacks = 0;
    s.enemyId++;
    s.enemyPhase = "entering";
    s.phaseTime = 0;
  }
}
export function applyMatch(s: Run, gems: Gem[], combo = 1, quantity = 1) {
  if (s.defeated) return 0;
  const st = stats(s.levels, s.relics, s.totalShards),
    mult = combo * st.power * quantity;
  let dealt = 0;
  for (const g of gems) {
    const amount =
      (0.25 + (g === "sword" ? 0.6 : g === "fire" ? 0.5 : 0)) * st.atk * mult;
    dealt += amount;
    if (g === "fire" && s.enemyPhase === "active") {
      s.burn = 3;
      s.burnTimer = 0;
    }
    if (g === "mana") s.sp += 3 * mult * st.focus;
    if (g === "heart") {
      const healed = Math.min(st.hp - s.hp, 0.02 * st.hp * mult);
      s.hp += healed;
      emit(s, { type: "heal", amount: healed });
    }
    if (g === "coin") {
      const gold = 10 * s.floor ** 0.8 * st.gold * mult;
      gainGold(s, gold);
      emit(s, { type: "gold", amount: gold });
    }
  }
  s.sp = Math.min(100, s.sp + gems.length * mult * st.focus);
  s.lastDamage = s.enemyPhase === "active" ? dealt : 0;
  s.combo = combo;
  if (damage(s, dealt, "match"))
    emit(s, {
      type: "match",
      amount: dealt,
      gem: gems.includes("fire") ? "fire" : "sword",
      combo,
    });
  return s.lastDamage;
}
export function skillReason(s: Run, key: Skill) {
  return s.defeated
    ? "defeated"
    : s.cooldowns[key] > 0
      ? "cooldown"
      : s.sp < C.skills[key].cost
        ? "energy"
        : key === "fireball" && s.enemyPhase !== "active"
          ? "entering"
          : "";
}
export function useSkill(s: Run, key: Skill) {
  if (skillReason(s, key)) return false;
  s.sp -= C.skills[key].cost;
  s.cooldowns[key] = C.skills[key].cooldown;
  const st = stats(s.levels, s.relics, s.totalShards);
  if (key === "fireball") {
    damage(s, 6 * st.atk, "match");
    emit(s, { type: "fireball", amount: 6 * st.atk });
  }
  if (key === "heal") {
    const amount = Math.min(st.hp - s.hp, 0.4 * st.hp);
    s.hp += amount;
    emit(s, { type: "heal", amount });
  }
  if (key === "haste") {
    s.haste = 8;
    emit(s, { type: "haste", amount: 2 });
  }
  return true;
}
export function purchasePreview(s: Run, key: Upgrade, max = false) {
  let n = 0,
    cost = 0;
  do {
    const c = upgradeCost(key, s.levels[key] + n);
    if (!Number.isFinite(c) || cost + c > s.gold) break;
    cost += c;
    n++;
  } while (max && n < 1000);
  const levels = { ...s.levels, [key]: s.levels[key] + (n || 1) };
  levels[key] = Math.min(C.upgrades[key].cap, levels[key]);
  return {
    n,
    cost: n ? cost : upgradeCost(key, s.levels[key]),
    after: stats(levels, s.relics, s.totalShards),
  };
}
export function purchase(s: Run, key: Upgrade, max = false) {
  const p = purchasePreview(s, key, max);
  if (!p.n) return 0;
  const before = stats(s.levels, s.relics, s.totalShards).hp;
  s.gold -= p.cost;
  s.levels[key] += p.n;
  if (key === "hp") s.hp += stats(s.levels, s.relics, s.totalShards).hp - before;
  return p.n;
}
export function purchaseRelic(s: Run, key: Relic) {
  const level = s.relics[key] ?? 0,
    cost = relicCost(key, level);
  if (s.shards < cost) return false;
  const before = stats(s.levels, s.relics, s.totalShards).hp;
  s.shards -= cost;
  s.relics[key] = level + 1;
  s.hp += stats(s.levels, s.relics, s.totalShards).hp - before;
  return true;
}
export function rebirthReward(s: Run) {
  return s.best < REBIRTH_MIN_FLOOR
    ? 0
    : Math.max(
        1,
        Math.floor(
          REBIRTH.base *
            (s.best - REBIRTH.offset) ** REBIRTH.power *
            (1 + REBIRTH.crownBonus * (s.relics.crown ?? 0)),
        ),
      );
}
export function rebirth(s: Run, rng: Rng) {
  const reward = rebirthReward(s);
  if (!reward) return false;
  const oldBest = s.best,
    permanent = {
      shards: s.shards + reward,
      totalShards: s.totalShards + reward,
      rebirths: s.rebirths + 1,
      relics: { ...s.relics },
      bestEver: Math.max(s.bestEver, s.best),
      enemyId: s.enemyId + 1,
    };
  const start = Math.max(
    1,
    Math.min(1 + relicEffects(s.relics).boots, Math.floor(oldBest * 0.5)),
  );
  Object.assign(s, newRun(rng, start), permanent);
  s.hp = stats(s.levels, s.relics, s.totalShards).hp;
  eventQueues.set(s, []);
  emit(s, { type: "rebirth", amount: reward });
  return true;
}
export function format(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const units = ["", "K", "M", "B", "T", "Qa", "Qi"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return (i ? n.toFixed(n < 10 ? 1 : 0) : Math.floor(n).toString()) + units[i];
}
export const serialize = (s: Run) => JSON.stringify(s);
export function validateSave(raw: string | null): Run | null {
  try {
    if (!raw || raw.length > 20000) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || ![1, 2].includes(parsed.version)) return null;
    const template = newRun(seeded(1)),
      v = { ...parsed } as Run;
    if (parsed.version === 1)
      Object.assign(v, {
        version: 2,
        shards: 0,
        totalShards: 0,
        rebirths: 0,
        relics: {},
        bestEver: parsed.best,
        enemyMaxHp: Math.max(parsed.enemyHp, enemy(parsed.floor).hp),
        enemyId: 1,
        enemyPhase: "active",
        phaseTime: 0,
        enemyAttacks: 0,
      });
    if (
      !Array.isArray(v.board) ||
      v.board.length !== 36 ||
      v.board.some((g) => !GEMS.includes(g))
    )
      return null;
    for (const [k, value] of Object.entries(template))
      if (typeof value === "number") {
        const x = v[k as keyof Run];
        if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1e100)
          return null;
      }
    if (
      !Number.isInteger(v.floor) ||
      v.floor < 1 ||
      v.floor > 500 ||
      !Number.isInteger(v.best) ||
      v.best < v.floor ||
      v.best > 500 ||
      v.bestEver < v.best ||
      ![1, 2, 3].includes(v.wave) ||
      typeof v.defeated !== "boolean" ||
      !["entering", "active", "dying", "empty"].includes(v.enemyPhase)
    )
      return null;
    for (const k of Object.keys(C.upgrades) as Upgrade[])
      if (
        !v.levels ||
        !Number.isInteger(v.levels[k]) ||
        v.levels[k] < 0 ||
        v.levels[k] > C.upgrades[k].cap
      )
        return null;
    if (!v.relics || typeof v.relics !== "object" || Array.isArray(v.relics))
      return null;
    for (const [k, value] of Object.entries(v.relics))
      if (
        !Object.hasOwn(RELICS, k) ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > RELICS[k as Relic].cap
      )
        return null;
    for (const k of Object.keys(C.skills) as Skill[])
      if (
        !v.cooldowns ||
        !Number.isFinite(v.cooldowns[k]) ||
        v.cooldowns[k] < 0 ||
        v.cooldowns[k] > C.skills[k].cooldown
      )
        return null;
    if (
      v.hp > stats(v.levels, v.relics, v.totalShards).hp + 1e-6 ||
      v.sp > 100 ||
      (v.enemyHp <= 0 &&
        v.enemyPhase !== "dying" &&
        v.enemyPhase !== "empty") ||
      v.enemyHp > v.enemyMaxHp ||
      v.enemyMaxHp >
        Math.max(
          enemy(v.floor).hp,
          400 * 1.28 ** (v.floor - 1) * (v.floor % 5 === 0 ? 6 : 1),
        ) ||
      v.autoTimer > 4 ||
      v.enemyTimer > 4 ||
      v.haste > 8 ||
      v.burn > 3 ||
      v.phaseTime > 1 ||
      v.totalShards < v.shards ||
      !Number.isInteger(v.rebirths) ||
      !Number.isInteger(v.shards) ||
      !Number.isInteger(v.totalShards) ||
      !Number.isInteger(v.enemyId) ||
      !Number.isInteger(v.enemyAttacks)
    )
      return null;
    return Object.fromEntries(
      Object.keys(template).map((k) => [k, v[k as keyof Run]]),
    ) as unknown as Run;
  } catch {
    return null;
  }
}
export const SAVE_KEY = "match-hero.save.v2";
export const LEGACY_SAVE_KEY = "match-hero.save.v1";
export function loadSave(read: (key: string) => string | null) {
  const current = read(SAVE_KEY);
  return current !== null
    ? validateSave(current)
    : validateSave(read(LEGACY_SAVE_KEY));
}
export function debugFloor(search: string) {
  const p = new URLSearchParams(search).get("floor");
  return p && /^\d+$/.test(p) && Number(p) >= 1 && Number(p) <= 100
    ? Number(p)
    : null;
}
