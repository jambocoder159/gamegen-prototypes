import assert from "node:assert/strict";
import { logic as L } from "./load-logic.mjs";
let checks = 0;
const test = (name, fn) => {
  fn();
  console.log("PASS", name);
  checks++;
};
test("100 seeded boards: no initial matches and playable", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const b = L.createBoard(L.seeded(seed));
    assert.equal(L.matches(b).length, 0);
    assert.ok(L.possibleMove(b));
    assert.deepEqual(b, L.createBoard(L.seeded(seed)));
  }
});
test("valid swaps cascade, gravity/refill and star creation", () => {
  const b = L.createBoard(L.seeded(3));
  const move = L.possibleMove(b);
  const r = L.swap(b, ...move, L.seeded(9));
  assert.ok(r.valid);
  assert.ok(r.cascades.length);
  assert.equal(L.matches(r.board).length, 0);
  assert.ok(L.possibleMove(r.board));
  const line = [...b];
  line.splice(0, 6, "sword", "sword", "mana", "sword", "coin", "heart");
  line[8] = "sword";
  const four = L.swap(line, 2, 8, L.seeded(9));
  assert.ok(four.cascades[0].stars.length);
});
test("invalid/nonadjacent swaps leave board untouched", () => {
  const b = L.createBoard(L.seeded(5));
  assert.equal(L.swap(b, 0, 35, L.seeded(1)).valid, false);
  let found = false;
  for (let i = 0; i < 35; i++)
    if (L.adjacent(i, i + 1) && !L.swap(b, i, i + 1, L.seeded(2)).valid)
      found = true;
  assert.ok(found);
});
test("star swap blasts 3 × 3 and chains", () => {
  const b = L.createBoard(L.seeded(4));
  b[14] = "star";
  const r = L.swap(b, 14, 15, L.seeded(9));
  assert.ok(r.valid);
  assert.ok(r.cascades[0].cleared.length >= 9);
});
test("dead board detection and playable reshuffle", () => {
  const dead = Array.from(
    { length: 36 },
    (_, i) => L.GEMS[((i % 6) + Math.floor(i / 6) * 2) % 5],
  );
  assert.equal(L.possibleMove(dead), null);
  const rng = L.seeded(1768),
    board = L.createBoard(rng),
    result = L.swap(board, ...L.possibleMove(board), rng);
  assert.ok(result.reshuffled);
  assert.equal(L.matches(result.board).length, 0);
  assert.ok(L.possibleMove(result.board));
});
test("skill cost, cooldown, heal and haste", () => {
  const s = L.newRun(L.seeded(1));
  assert.equal(L.useSkill(s, "fireball"), false);
  s.enemyPhase = "active";
  s.sp = 100;
  assert.ok(L.useSkill(s, "fireball"));
  assert.equal(s.sp, 70);
  assert.equal(L.useSkill(s, "fireball"), false);
  s.hp = 20;
  L.useSkill(s, "heal");
  assert.equal(s.hp, 60);
  L.useSkill(s, "haste");
  assert.equal(s.haste, 8);
});
test("upgrade costs, caps and Max purchases", () => {
  const s = L.newRun(L.seeded(1));
  assert.equal(L.upgradeCost("atk", 0), 20);
  assert.equal(L.upgradeCost("atk", 1), 24);
  assert.equal(L.upgradeCost("crit", 55), Infinity);
  s.gold = 100;
  assert.ok(L.purchase(s, "atk", true) > 1);
  assert.equal(L.purchase(s, "focus"), 0);
});
test("defeat retreats and keeps gold", () => {
  const s = L.newRun(L.seeded(1), 9);
  s.enemyPhase = "active";
  s.gold = 42;
  s.hp = 0.01;
  s.enemyTimer = 3;
  L.tick(s, 0.1, L.seeded(1));
  assert.ok(s.defeated);
  assert.equal(s.floor, 6);
  assert.equal(s.hp, 100);
  assert.equal(s.gold, 42);
});
test("save round trip and corrupt data", () => {
  const s = L.newRun(L.seeded(2));
  assert.deepEqual(L.validateSave(L.serialize(s)), s);
  for (const bad of [
    "{}",
    "null",
    "bad",
    JSON.stringify({ ...s, hp: -2 }),
    JSON.stringify({ ...s, board: [] }),
    JSON.stringify({ ...s, cooldowns: {} }),
    JSON.stringify({ ...s, levels: { atk: 2 } }),
  ])
    assert.equal(L.validateSave(bad), null);
});
test("formatting and debug validation", () => {
  assert.equal(L.format(1250), "1.3K");
  assert.equal(L.format(2e6), "2.0M");
  assert.equal(L.format(3e9), "3.0B");
  assert.equal(L.format(4e12), "4.0T");
  assert.equal(L.debugFloor("?floor=-1"), null);
  assert.equal(L.debugFloor("?floor=5"), 5);
});

test("entry is immune; death unmount gap precedes next entry", () => {
  const s = L.newRun(L.seeded(1));
  const max = s.enemyHp;
  L.damage(s, 99999, "match");
  assert.equal(s.enemyHp, max);
  L.tick(s, 0.4, L.seeded(1));
  assert.equal(s.enemyPhase, "active");
  L.damage(s, max, "match");
  assert.equal(s.enemyPhase, "dying");
  assert.equal(s.wave, 1);
  L.tick(s, 0.44, L.seeded(1));
  assert.equal(s.enemyPhase, "dying");
  L.tick(s, 0.01, L.seeded(1));
  assert.equal(s.enemyPhase, "empty");
  L.tick(s, 0.06, L.seeded(1));
  assert.equal(s.wave, 2);
  assert.equal(s.enemyPhase, "entering");
  const hp = s.enemyHp;
  L.applyMatch(s, ["sword", "fire"]);
  L.tick(s, 0.2, L.seeded(1));
  assert.equal(s.enemyHp, hp);
  assert.equal(s.enemyTimer, 0);
  assert.equal(s.autoTimer, 0);
});
test("enemy charge and every third boss strike has longer charge and double damage", () => {
  const s = L.newRun(L.seeded(1), 5);
  s.enemyPhase = "active";
  s.hp = 10000;
  s.autoTimer = -100;
  const rng = L.seeded(1);
  L.tick(s, 2.19, rng);
  assert.equal(s.enemyAttacks, 0);
  L.tick(s, 0.01, rng);
  assert.equal(s.enemyAttacks, 1);
  L.tick(s, 2.2, rng);
  assert.equal(s.enemyAttacks, 2);
  const hp = s.hp;
  assert.ok(Math.abs(L.chargeDuration(s) - 3.3) < 1e-6);
  L.tick(s, 3.29, rng);
  assert.equal(s.hp, hp);
  L.tick(s, 0.01, rng);
  assert.equal(s.enemyAttacks, 3);
  assert.ok(Math.abs(hp - s.hp - 2 * L.enemy(5).atk) < 1e-6);
});
test("relic effects, caps, shield mitigation, costs and HP purchase", () => {
  const s = L.newRun(L.seeded(1));
  s.shards = s.totalShards = 10000;
  const base = L.stats(s.levels);
  for (const k of [
    "sword",
    "feather",
    "ring",
    "amulet",
    "tome",
    "core",
    "badge",
    "shield",
    "flame",
  ])
    assert.ok(L.purchaseRelic(s, k));
  const st = L.stats(s.levels, s.relics);
  assert.equal(st.atk, base.atk * 1.2);
  assert.ok(Math.abs(st.hp - 110) < 1e-6);
  assert.equal(st.gold, 1.1);
  assert.equal(st.power, 1.08);
  assert.equal(st.focus, 1.08);
  assert.equal(st.crit, 0.055);
  assert.ok(st.interval < base.interval);
  s.enemyPhase = "active";
  s.enemyTimer = 2.7;
  s.autoTimer = -100;
  const hp = s.hp;
  L.tick(s, 0.01, L.seeded(1));
  assert.ok(Math.abs(hp - s.hp - L.enemy(1).atk * 0.98) < 1e-6);
  assert.equal(L.relicCost("sword", 100), Infinity);
  assert.equal(L.stats({ ...s.levels, crit: 55 }, { badge: 40 }).crit, 0.6);
});
test("rebirth unlock, formula, reset, permanence and starting floor clamp", () => {
  const rng = L.seeded(1),
    s = L.newRun(rng);
  assert.equal(L.rebirth(s, rng), false);
  s.best = 10;
  s.bestEver = 12;
  s.floor = 9;
  s.gold = 123;
  s.levels.atk = 4;
  s.relics = { crown: 1, boots: 20 };
  s.cooldowns.heal = 2;
  s.sp = 80;
  const reward = L.rebirthReward(s);
  assert.equal(reward, Math.floor(0.6 * 5 ** 1.35 * 1.1));
  assert.ok(L.rebirth(s, rng));
  assert.equal(s.floor, 5);
  assert.equal(s.shards, reward);
  assert.equal(s.totalShards, reward);
  assert.equal(s.rebirths, 1);
  assert.equal(s.gold, 0);
  assert.equal(s.sp, 0);
  assert.equal(s.levels.atk, 0);
  assert.equal(s.cooldowns.heal, 0);
  assert.equal(s.bestEver, 12);
  assert.equal(s.relics.boots, 20);
  assert.equal(s.enemyPhase, "entering");
});
test("v1 fixture migrates without changing floor, gold, upgrades or board", () => {
  const legacy = {
    version: 1,
    board: L.createBoard(L.seeded(7)),
    levels: { atk: 5, speed: 2, crit: 1, hp: 3, power: 2, gold: 1, focus: 0 },
    gold: 1234,
    totalGold: 5678,
    floor: 7,
    best: 9,
    wave: 2,
    enemyHp: 500,
    hp: 123,
    sp: 42,
    autoTimer: 0.4,
    enemyTimer: 1.1,
    burn: 2,
    burnTimer: 0.3,
    haste: 4,
    cooldowns: { fireball: 1, heal: 0, haste: 3 },
    defeated: false,
    elapsed: 360,
    autoDamage: 2000,
    matchDamage: 3000,
    lastDamage: 30,
    combo: 1.25,
    kills: 20,
  };
  const migrated = L.validateSave(JSON.stringify(legacy));
  assert.ok(migrated);
  for (const k of Object.keys(legacy).filter((k) => k !== "version"))
    assert.deepEqual(migrated[k], legacy[k]);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.shards, 0);
  assert.equal(migrated.totalShards, 0);
  assert.equal(migrated.rebirths, 0);
  assert.equal(migrated.bestEver, 9);
  assert.deepEqual(migrated.relics, {});
  const late = {
    ...legacy,
    floor: 30,
    best: 30,
    enemyHp: 400 * 1.28 ** 29 * 6,
  };
  assert.equal(L.validateSave(JSON.stringify(late)).enemyHp, late.enemyHp);
  assert.ok(L.validateSave(L.serialize(L.validateSave(JSON.stringify(late)))));
  const read = (k) => (k === L.LEGACY_SAVE_KEY ? JSON.stringify(legacy) : null);
  assert.deepEqual(L.loadSave(read), migrated);
  assert.equal(
    L.loadSave((k) => (k === L.SAVE_KEY ? "bad" : read(k))),
    null,
  );
});
test("Max preview and purchase use identical shared stat formula", () => {
  const s = L.newRun(L.seeded(1));
  s.gold = 10000;
  s.relics.sword = 3;
  const preview = L.purchasePreview(s, "atk", true);
  assert.ok(preview.n > 1);
  assert.equal(L.purchase(s, "atk", true), preview.n);
  assert.deepEqual(L.stats(s.levels, s.relics), preview.after);
});
test("v2 rejects invalid relic levels and accepts death saves", () => {
  const s = L.newRun(L.seeded(1));
  for (const value of [{ shield: 31 }, { sword: -1 }, { foo: 1 }])
    assert.equal(L.validateSave(JSON.stringify({ ...s, relics: value })), null);
  s.enemyPhase = "active";
  L.damage(s, s.enemyHp, "match");
  assert.equal(L.validateSave(L.serialize(s)).enemyPhase, "dying");
});
test("lifetime shards give capped damage/gold multipliers and persist when spent", () => {
  const s = L.newRun(L.seeded(4));
  assert.equal(L.shardBonus(0), 0);
  assert.equal(L.shardBonus(1), 0.02);
  assert.equal(L.shardBonus(50), 1);
  assert.equal(L.shardBonus(500), 1);
  s.shards = s.totalShards = 5;
  assert.ok(L.purchaseRelic(s, "sword"));
  assert.equal(s.shards, 4);
  assert.equal(s.totalShards, 5);
  const st = L.stats(s.levels, s.relics, s.totalShards);
  assert.equal(st.atk, 5 * 1.2 * 1.1);
  assert.equal(st.gold, 1.1);
  assert.deepEqual(L.validateSave(L.serialize(s)), s);
  s.gold = 1000;
  const p = L.purchasePreview(s, "atk", true);
  L.purchase(s, "atk", true);
  assert.deepEqual(L.stats(s.levels, s.relics, s.totalShards), p.after);
});
test("shard passive scales auto, match, fireball, burn and every gold source once", () => {
  const run = (shards) => {
    const s = L.newRun(L.seeded(4));
    s.totalShards = s.shards = shards;
    s.enemyPhase = "active";
    s.enemyHp = s.enemyMaxHp = 1e9;
    return s;
  };
  const compare = (act, value) => {
    const a = run(0), b = run(5);
    act(a); act(b);
    assert.ok(Math.abs(value(b) / value(a) - 1.1) < 1e-7);
  };
  compare(s => L.tick(s, 1, L.seeded(5)), s => s.autoDamage);
  compare(s => L.tick(s, 1, L.seeded(5)), s => s.totalGold);
  compare(s => L.applyMatch(s, ["sword", "coin", "fire"]), s => s.matchDamage);
  compare(s => L.applyMatch(s, ["coin"]), s => s.totalGold);
  compare(s => { s.sp = 100; L.useSkill(s, "fireball"); }, s => s.matchDamage);
  compare(s => { s.burn = 3; L.tick(s, 1, L.seeded(5)); }, s => s.matchDamage);
  compare(s => L.damage(s, s.enemyHp, "auto"), s => s.totalGold);
  compare(s => { s.wave = 3; s.enemyPhase = "empty"; L.tick(s, .06, L.seeded(5)); }, s => s.totalGold);
});
console.log(`${checks}/${checks} logic checks passed`);
