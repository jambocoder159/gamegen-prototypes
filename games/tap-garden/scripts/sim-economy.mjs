// Economy simulation for the "standard player" (PLAN §3.6), driving the real game
// logic (bundled from TypeScript via esbuild — no new runtime deps). The model:
//   • 4 manual taps / second (crits + auto-tap come from the logic itself)
//   • merges any matching pair as soon as possible
//   • every 10 s makes greedy best-value purchases (upgrade lines / plot / seeds,
//     scored by marginal dew-per-second gained per dew spent; merge burst and seed
//     quality are valued from the observed merge / seed rates), and keeps buying
//     seeds while a boss stage is blocked by its plant-level requirement
//   • rebirths as soon as it is available AND worthwhile: stage ≥ 10 and the next
//     stage would take longer than REBIRTH_ETA_SEC at the current income
//   • after each rebirth spends sun coins greedily on relics (buy-unlock / upgrade,
//     falling back to draws)
//
// Prints minutes to stage 10 and to the rebirth for runs 1–5, max stage, coins per
// rebirth, and the upgrade / relic levels at each rebirth; then asserts the PLAN
// targets (exit code 1 on a miss). `npm run test:sim` runs this file.

import { loadLogic } from './logic-harness.mjs';

const DT = 0.25; // sim step (s)
const TAPS_PER_SEC = 4;
const DECISION_SEC = 10;
const REBIRTH_ETA_SEC = 60; // "worthwhile": next stage would take longer than this
const MAX_RUN_SEC = 90 * 60; // safety cap per run
const RUNS = 5;

const { Logic, Config, Relics, Upgrades, Rebirth } = await loadLogic();
const { U, R } = Config;

// --- helpers -----------------------------------------------------------------
function incomeRate(state) {
  const d = Logic.derive(state);
  return d.passivePerSec + (TAPS_PER_SEC + d.autoRate) * d.expectedTap;
}

function plantCount(state) {
  let n = 0;
  for (const i of Config.unlockedPlots(state.unlocked)) if (state.plots[i] > 0) n++;
  return n;
}

// Merge every available matching pair (lowest levels first). Counts merges.
function mergeAll(state, stats) {
  let s = state;
  for (let guard = 0; guard < 64; guard++) {
    let done = false;
    const p = s.plots;
    for (const i of Config.unlockedPlots(s.unlocked)) {
      if (done) break;
      if (p[i] === 0 || p[i] >= Config.MAX_LEVEL) continue;
      for (const j of Config.unlockedPlots(s.unlocked)) {
        if (j <= i) continue;
        if (p[j] !== p[i]) continue;
        const res = Logic.merge(s, i, j);
        if (res.ok) {
          s = res.state;
          stats.merges++;
          stats.mergeLevelSum += res.newLevel;
          done = true;
        }
        break;
      }
    }
    if (!done) break;
  }
  return s;
}

// Extra dew/s an upgrade gives that incomeRate() cannot see (merge burst, seed
// quality), estimated from the merge / seed rates observed so far this run.
function hiddenValue(state, index, stats, elapsed) {
  if (elapsed <= 0) return 0;
  const d = Logic.derive(state);
  if (index === U.merge) {
    const mergesPerSec = stats.merges / elapsed;
    const avgLevel = stats.merges ? stats.mergeLevelSum / stats.merges : 2;
    const perMerge =
      Config.MERGE_BURST_SECONDS * Config.incomeForLevel(avgLevel) * d.plantMult * Config.MERGE_BURST_PER_LEVEL;
    return mergesPerSec * perMerge;
  }
  if (index === U.seed) {
    const seedsPerSec = stats.seeds / elapsed;
    return seedsPerSec * Config.SEED_QUALITY_PER_LEVEL * d.seedCost; // a lv-2 seed saves one seed
  }
  return 0;
}

// One decision window: keep buying the best-value affordable item.
function decide(state, stats, elapsed) {
  let s = state;
  for (let guard = 0; guard < 300; guard++) {
    const d = Logic.derive(s);
    const base = incomeRate(s);
    let best = null; // { score, apply }
    const consider = (score, apply) => {
      if (score > 0 && (!best || score > best.score)) best = { score, apply };
    };

    for (const v of d.upgrades) {
      if (v.atMax || v.cost > s.dew) continue;
      const after = Upgrades.buyUpgrade(s, v.index, 'one').state;
      const gain = incomeRate(after) - base + hiddenValue(s, v.index, stats, elapsed);
      consider(gain / v.cost, () => after);
    }
    if (d.nextPlotCost <= s.dew) {
      // one more plot ≈ one more average plant
      const n = plantCount(s);
      const avg = n > 0 ? d.passivePerSec / n : d.plantMult * Config.incomeForLevel(1);
      consider(avg / d.nextPlotCost, () => Upgrades.buyPlot(s).state);
    }
    if (plantCount(s) < s.unlocked && d.seedCost <= s.dew) {
      let score = (d.plantMult * Config.incomeForLevel(1) * 2) / d.seedCost; // seeds feed merges
      if (d.isBoss && !d.bossMet) score *= 50; // grow a big plant to beat the boss
      if (plantCount(s) < 4) score *= 4; // keep the merge engine fed early
      consider(score, () => {
        stats.seeds++;
        return Logic.buySeed(s).state;
      });
    }
    if (!best) break;
    s = mergeAll(best.apply(), stats);
  }
  return s;
}

// Greedy relic spending after a rebirth (value weight per coin).
const RELIC_WEIGHT = {
  [R.sun]: 1.0, [R.lens]: 0.9, [R.acorn]: 0.7, [R.lotus]: 0.6, [R.clover]: 0.4,
  [R.thunder]: 0.38, [R.can]: 0.34, [R.bee]: 0.3, [R.cloud]: 0.28, [R.moon]: 0.2,
  [R.trowel]: 0.22, [R.ladybug]: 0.16,
};
function spendCoins(state) {
  let s = state;
  for (let guard = 0; guard < 1000; guard++) {
    let best = null; // { score, idx, kind }
    for (let i = 0; i < Config.RELIC_COUNT; i++) {
      const w = RELIC_WEIGHT[i];
      const lv = s.relics[i];
      if (lv === 0) {
        if (s.sunCoins >= Config.UNLOCK_COST && w >= 0.5) {
          const score = w / Config.UNLOCK_COST;
          if (!best || score > best.score) best = { score, idx: i, kind: 'unlock' };
        }
      } else if (lv < Config.RELICS[i].max) {
        const cost = Config.relicUpgradeCost(i, lv);
        if (cost <= s.sunCoins) {
          const score = w / cost;
          if (!best || score > best.score) best = { score, idx: i, kind: 'up' };
        }
      }
    }
    if (best) {
      s = best.kind === 'unlock' ? Relics.buyRelic(s, best.idx).state : Relics.upgradeRelic(s, best.idx).state;
      continue;
    }
    if (s.sunCoins >= Config.DRAW_COST) {
      const res = Relics.drawRelic(s);
      if (!res.ok) break;
      s = res.state;
      continue;
    }
    break;
  }
  return s;
}

function runOnce(state, runIndex) {
  let s = state;
  let t = 0;
  let tapAcc = 0;
  let sinceDecision = DECISION_SEC; // decide on the first step
  let timeToStage10 = null;
  let earlyShare = null;
  const stats = { merges: 0, mergeLevelSum: 0, seeds: 0 };

  while (t < MAX_RUN_SEC) {
    tapAcc += TAPS_PER_SEC * DT;
    while (tapAcc >= 1) {
      s = Logic.tap(s).state;
      tapAcc -= 1;
    }
    if (s.stage >= Config.AUTO_MERGE_STAGE && !s.autoMerge) s = Logic.toggleAutoMerge(s);
    s = Logic.tick(s, DT).state;
    if (t >= 60 && !earlyShare) earlyShare = {...s.runStats};
    s = mergeAll(s, stats);
    if (timeToStage10 === null && s.maxStage >= Config.REBIRTH_STAGE) timeToStage10 = t;

    sinceDecision += DT;
    if (sinceDecision >= DECISION_SEC) {
      sinceDecision = 0;
      s = decide(s, stats, t);
      if (s.maxStage >= Config.REBIRTH_STAGE) {
        const d = Logic.derive(s);
        const eta = d.isBoss && !d.bossMet ? Infinity : (d.goal - s.earned) / incomeRate(s);
        if (eta > REBIRTH_ETA_SEC) break; // pushing on is slow → rebirth now
      }
    }
    t += DT;
  }

  const levels = {
    up: Object.fromEntries(Config.UPGRADES.map((u, i) => [u.key, s.upgrades[i]])),
    plots: s.unlocked,
    relics: Object.fromEntries(Config.RELICS.map((r, i) => [r.key, s.relics[i]])),
  };
  const res = Rebirth.applyRebirth(s);
  const result = { runIndex, timeToStage10, rebirthTime: t, maxStage: s.maxStage, coins: res.coins, levels, income: s.runStats, earlyShare, autoMerge: s.autoMerge };
  return { result, next: spendCoins(res.ok ? res.state : s) };
}

// --- run ---------------------------------------------------------------------
let state = Logic.newGame();
const results = [];
for (let r = 1; r <= RUNS; r++) {
  const { result, next } = runOnce(state, r);
  results.push(result);
  state = next;
}
const relicsAfter = Object.fromEntries(Config.RELICS.map((r, i) => [r.key, state.relics[i]]));

const fmtMin = (sec) => (sec == null ? 'n/a' : (sec / 60).toFixed(1));
const speedups = results.slice(1).map((r, i) => {
  const prev = results[i].timeToStage10;
  return prev != null && r.timeToStage10 != null ? ((prev - r.timeToStage10) / prev) * 100 : null;
});

console.log('\n=== Tap Garden economy simulation (standard player) ===');
console.log(
  `constants: STAGE_BASE=${Config.STAGE_BASE} STAGE_GROWTH=${Config.STAGE_GROWTH} ` +
    `REBIRTH_COIN_MULT=${Config.REBIRTH_COIN_MULT} LIFETIME_BONUS_PER_COIN=${Config.LIFETIME_BONUS_PER_COIN}\n`,
);
console.log('| Run | to stage 10 (min) | rebirth at (min) | max stage | sun coins | speed-up to stage 10 |');
console.log('|---|---|---|---|---|---|');
results.forEach((r, i) => {
  const sp = i === 0 ? '—' : speedups[i - 1] == null ? 'n/a' : `${speedups[i - 1].toFixed(0)}%`;
  console.log(
    `| ${r.runIndex} | ${fmtMin(r.timeToStage10)} | ${fmtMin(r.rebirthTime)} | ${r.maxStage} | ${r.coins} | ${sp} |`,
  );
});

const upKeys = Config.UPGRADES.map((u) => u.key);
console.log('\nUpgrade levels at each rebirth:\n');
console.log(`| Run | ${upKeys.join(' | ')} | plots |`);
console.log(`|---|${upKeys.map(() => '---|').join('')}---|`);
for (const r of results) {
  console.log(`| ${r.runIndex} | ${upKeys.map((k) => r.levels.up[k]).join(' | ')} | ${r.levels.plots} |`);
}
const relKeys = Config.RELICS.map((x) => x.key);
console.log('\nRelic levels at each rebirth (bought with the coins of earlier runs):\n');
console.log(`| Run | ${relKeys.join(' | ')} |`);
console.log(`|---|${relKeys.map(() => '---|').join('')}`);
for (const r of results) console.log(`| ${r.runIndex} | ${relKeys.map((k) => r.levels.relics[k]).join(' | ')} |`);
console.log(`| after ${RUNS} | ${relKeys.map((k) => relicsAfter[k]).join(' | ')} |`);

console.log('\nIncome shares (production only; merge/chest bonuses reported separately):');
console.log('| Run | click | auto | passive | bonus / all earned | first 60s click | auto-merge |');
console.log('|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = r.income; const total = c.click + c.auto + c.passive;
  const pct = v => (100 * v / total).toFixed(1) + '%';
  const e = r.earlyShare; const early = e ? (100 * e.click / (e.click + e.auto + e.passive)).toFixed(1) + '%' : 'run <60s';
  console.log(`| ${r.runIndex} | ${pct(c.click)} | ${pct(c.auto)} | ${pct(c.passive)} | ${(100*c.bonus/c.dew).toFixed(1)}% | ${early} | ${r.autoMerge ? 'on' : 'off'} |`);
}

// --- target assertions (PLAN §3.6) ------------------------------------------
const firstRebirth = results[0].rebirthTime / 60;
const early = results[0].earlyShare;
const earlyClick = early.click / (early.click + early.auto + early.passive);
const checks = [
  ['new account first-minute click share is 60–70%', earlyClick >= 0.6 && earlyClick <= 0.7, `${(100*earlyClick).toFixed(1)}%`],
  ['developed runs have ≥70% auto/plant production', results.every(r => (r.income.auto + r.income.passive) / (r.income.click + r.income.auto + r.income.passive) >= 0.7), 'all five runs'],
  ['first rebirth within 10–20 min', firstRebirth >= 10 && firstRebirth <= 20, `${firstRebirth.toFixed(1)} min`],
  [
    'runs 2, 3, 4 each reach stage 10 ≥30% faster than the previous run',
    [0, 1, 2].every((i) => speedups[i] != null && speedups[i] >= 30),
    speedups.slice(0, 3).map((x) => (x == null ? 'n/a' : `${x.toFixed(0)}%`)).join(', '),
  ],
  ['max stage in run 4 is ≥ 15', results[3].maxStage >= 15, `stage ${results[3].maxStage}`],
];
console.log('\nTarget checks:');
let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name} :: ${detail}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed} economy target(s) missed.`);
  process.exit(1);
}
console.log('\nALL ECONOMY TARGETS MET');
