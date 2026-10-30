import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { RELICS } from "./load-logic.mjs";
import { logic as L } from "./load-logic.mjs";

// Shared tick includes entry, death, charge, heavy attacks, shield and rebirth.
// Players buy affordable upgrades once a second, with HP before offense when hurt.
export function simulate(
  active,
  seed = 42,
  reborn = false,
  strategy = buyRelics,
) {
  const rng = L.seeded(seed),
    s = L.newRun(rng),
    times = {},
    bossLosses = [];
  let nextMatch = 3,
    defeats = 0,
    bossLoss = 0,
    bossId = 0,
    first10 = 0,
    second = false,
    wall = 0;
  const firstTimes = {};
  for (let step = 0; step < 180000; step++) {
    wall = step * 0.1;
    if (s.floor % 5 === 0 && s.enemyId !== bossId) {
      bossId = s.enemyId;
      bossLoss = 0;
    }
    L.tick(s, 0.1, rng);
    for (const e of L.drainEvents(s))
      if (e.type === "hurt" && s.floor % 5 === 0)
        bossLoss += (e.amount / L.stats(s.levels, s.relics, s.totalShards).hp) * 100;
    if (s.enemyPhase === "dying" && s.floor % 5 === 0 && bossLoss > 0) {
      bossLosses.push(bossLoss);
      bossLoss = 0;
    }
    if (s.defeated) {
      defeats++;
      s.defeated = false;
    }
    if (active && wall >= nextMatch) {
      nextMatch += 3;
      L.applyMatch(
        s,
        Array.from({ length: 3 }, () => L.GEMS[Math.floor(rng() * 5)]),
        1,
        3.2 / 3,
      );
    }
    if (active) {
      if (s.hp < L.stats(s.levels, s.relics, s.totalShards).hp * 0.5) L.useSkill(s, "heal");
      L.useSkill(s, "haste");
      L.useSkill(s, "fireball");
    }
    if (step % 10 === 0) {
      const keys = active
        ? ["atk", "speed", "hp", "power", "gold", "crit", "focus"]
        : ["atk", "speed", "hp", "gold", "crit"];
      keys.sort(
        (a, b) => L.upgradeCost(a, s.levels[a]) - L.upgradeCost(b, s.levels[b]),
      );
      for (const k of keys) L.purchase(s, k);
    }
    for (const f of [5, 10, 15, 20])
      if (s.floor >= f && !times[f]) times[f] = s.elapsed / 60;
    if (reborn && !second && times[10]) {
      first10 = times[10];
      Object.assign(firstTimes, times);
      L.rebirth(s, rng);
      strategy(s);
      second = true;
      for (const f of Object.keys(times)) delete times[f];
      bossLosses.length = 0;
      defeats = 0;
    }
    if (times[20]) break;
  }
  return {
    player: reborn
      ? "Matcher, second run"
      : active
        ? "Standard matcher"
        : "Auto only",
    ...Object.fromEntries(
      [5, 10, 15, 20].map((f) => [
        "floor" + f,
        times[f] ? +times[f].toFixed(2) : null,
      ]),
    ),
    defeats,
    bossLoss: +(
      bossLosses.reduce((a, b) => a + b, 0) / Math.max(1, bossLosses.length)
    ).toFixed(1),
    autoShare: +(
      (100 * s.autoDamage) /
      Math.max(1, s.autoDamage + s.matchDamage)
    ).toFixed(1),
    matchShare: +(
      (100 * s.matchDamage) /
      Math.max(1, s.autoDamage + s.matchDamage)
    ).toFixed(1),
    ...(reborn
      ? {
          first10: +first10.toFixed(2),
          faster: +((1 - times[10] / first10) * 100).toFixed(1),
          relics: s.relics,
        }
      : {}),
  };
}
export function buyRelics(s) {
  // Prefer marginal attack gain per shard. Other offensive relics join once their
  // return exceeds another sword level; defense remains an option for later runs.
  for (let i = 0; i < 100; i++) {
    const scores = [
      ["sword", RELICS.sword.step / (1 + RELICS.sword.step * (s.relics.sword ?? 0))],
      ["feather", 0.03 / (1 + 0.03 * (s.relics.feather ?? 0))],
      ["tome", (0.08 * 0.45) / (1 + 0.08 * (s.relics.tome ?? 0))],
      ["ring", (0.1 * 0.35) / (1 + 0.1 * (s.relics.ring ?? 0))],
    ]
      .map(([k, gain]) => ({ k, cost: L.relicCost(k, s.relics[k] ?? 0), gain }))
      .filter((x) => x.cost <= s.shards)
      .sort((a, b) => b.gain / b.cost - a.gain / a.cost);
    if (!scores.length) break;
    L.purchaseRelic(s, scores[0].k);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const rows = [simulate(false), simulate(true), simulate(true, 42, true)];
  console.table(rows);
  writeFileSync(
    "/workspace/gamegen-games/_reports/mh2_sim.json",
    JSON.stringify(rows, null, 2) + "\n",
  );
  if (!process.env.TUNE) {
    const checks = [
      [
        "standard floor10 6–10 minutes",
        rows[1].floor10 >= 6 && rows[1].floor10 <= 10,
      ],
      ["auto at least 40% slower", rows[0].floor10 >= rows[1].floor10 * 1.4],
      ["standard floor20 within 30 minutes", rows[1].floor20 <= 30],
      ["auto progresses to floor20", !!rows[0].floor20],
      ["both standard runs at most two retreats", rows[1].defeats <= 2 && rows[2].defeats <= 2],
      [
        "auto two to five retreats",
        rows[0].defeats >= 2 && rows[0].defeats <= 5,
      ],
      [
        "both standard runs boss damage 40–70% of max HP",
        [rows[1], rows[2]].every(r => r.bossLoss >= 40 && r.bossLoss <= 70),
      ],
      [
        "rebirth 25–45% faster and at least 3 minutes",
        rows[2].faster >= 25 && rows[2].faster <= 45 && rows[2].floor10 >= 3,
      ],
    ];
    for (const [name, ok] of checks)
      console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    console.log(
      `${checks.filter((x) => x[1]).length}/${checks.length} balance checks passed`,
    );
    if (checks.some((x) => !x[1])) process.exitCode = 1;
  }
}
