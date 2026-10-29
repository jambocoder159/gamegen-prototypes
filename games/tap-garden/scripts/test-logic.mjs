// Unit tests for the pure game logic and number formatting, run against the real
// TypeScript modules (bundled with esbuild). No browser needed.
import { loadLogic, installLocalStorage } from './logic-harness.mjs';

installLocalStorage();
const M = await loadLogic();
const { Logic, Config, Format, Relics, Upgrades, Rebirth, Stages, Save, Rng } = M;

let passed = 0;
let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL — ${name}${detail ? ' :: ' + detail : ''}`);
  }
}
function eq(name, a, b) {
  ok(name, a === b, `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);
}
function approx(name, a, b, tol = 1e-6) {
  ok(name, Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a} expected ${b}`);
}

// --- format ------------------------------------------------------------------
const f = Format.formatNumber;
eq('format 0', f(0), '0');
eq('format 42', f(42), '42');
eq('format 999', f(999), '999');
eq('format 1000', f(1000), '1K');
eq('format 1234', f(1234), '1.23K');
eq('format 12345', f(12345), '12.3K');
eq('format 123456', f(123456), '123K');
eq('format 1e6', f(1e6), '1M');
eq('format 1.5e6', f(1.5e6), '1.5M');
eq('format 1e9', f(1e9), '1B');
eq('format 1e12', f(1e12), '1T');
eq('format 1e15', f(1e15), '1Qa');
eq('format 1e18', f(1e18), '1Qi');
eq('format 1e21', f(1e21), '1Sx');
eq('format 1e24', f(1e24), '1Sp');
eq('format 1e27', f(1e27), '1Oc');
eq('format 1e30', f(1e30), '1No');
eq('format 1e33', f(1e33), '1Dc');
ok('format 1e36 scientific', /e/.test(f(1e36)), f(1e36));
eq('format 1.23e36', f(1.23e36), '1.23e36');
eq('format boundary 999950', f(999950), '1M'); // tier guard
eq('format rate small', Format.formatRate(2.5), '2.5');
eq('format rate zero', Format.formatRate(0), '0');
eq('format negative', f(-1500), '-1.5K');

// --- config formulas ---------------------------------------------------------
approx('incomeForLevel 1', Config.incomeForLevel(1), 0.5);
approx('incomeForLevel 9', Config.incomeForLevel(9), 0.5 * 2 ** 8);
eq('incomeForLevel 0', Config.incomeForLevel(0), 0);
eq('stageGoal 1', Config.stageGoal(1), Config.STAGE_BASE);
ok('isBossStage 5', Config.isBossStage(5));
ok('isBossStage 10', Config.isBossStage(10));
ok('isBossStage 7 false', !Config.isBossStage(7));
eq('bossRequiredLevel 5', Config.bossRequiredLevel(5), 3);
eq('bossRequiredLevel 10', Config.bossRequiredLevel(10), 4);
eq('plotCost step0', Config.plotCost(0), 200);
eq('plotCost step1', Config.plotCost(1), 1600);
eq('seedCost no discount', Config.seedCost(0, 0), 10);

// --- RNG determinism ---------------------------------------------------------
const a1 = Config.RNG_SEED;
const r1 = Rng.nextRng(a1);
const r2 = Rng.nextRng(a1);
eq('rng deterministic', r1.value, r2.value);
ok('rng in [0,1)', r1.value >= 0 && r1.value < 1);

// --- tap / earn / stages -----------------------------------------------------
let s = Logic.newGame();
const t = Logic.tap(s);
ok('tap earns dew', t.state.dew > 0);
ok('tap credits stage earn', t.state.earned > 0);

// earning enough clears stage 1 (non-boss)
s = Logic.newGame();
let big = { ...s, dew: 0 };
const earnRes = Logic.tick({ ...big, plots: big.plots }, 0); // no-op guard
ok('tick dt<=0 no-op', earnRes.state === big || earnRes.state.dew === big.dew);

// Give a plant and verify passive income accrues + stage advances.
s = Logic.newGame();
s = { ...s, plots: s.plots.slice() };
s.plots[0] = 5; // a decent producer
const before = s.dew;
const ticked = Logic.tick(s, 10).state;
ok('passive income accrues', ticked.dew > before);

// Force a stage clear by injecting earned dew close to the goal.
s = Logic.newGame();
s.plots[0] = 3;
s = { ...s, earned: Config.stageGoal(1) - 0.01 };
const adv = Logic.tick(s, 60).state; // plenty of passive to cross the goal
ok('stage advances past goal', adv.stage >= 2, `stage=${adv.stage}`);

// Boss stage gating: stage 5 needs a level-3 plant.
s = Logic.newGame();
s = { ...s, stage: 5, maxStage: 5, earned: Config.stageGoal(5) + 1, plots: s.plots.slice() };
s.plots[0] = 2; // too low for boss 5 (needs 3)
const blocked = Logic.tick(s, 1).state;
eq('boss blocks advance without plant', blocked.stage, 5);
s.plots[0] = 3; // now qualifies
const unblocked = Logic.tick({ ...s, earned: Config.stageGoal(5) + 1 }, 1).state;
ok('boss advances with qualifying plant', unblocked.stage >= 6, `stage=${unblocked.stage}`);

// --- buy seed / merge --------------------------------------------------------
s = Logic.newGame();
s = { ...s, dew: 1000 };
const bs = Logic.buySeed(s);
ok('buySeed plants a seed', bs.ok && bs.state.plots.some((v) => v >= 1));
ok('buySeed spends dew', bs.state.dew < 1000);

s = Logic.newGame();
s = { ...s, plots: s.plots.slice(), dew: 0 };
s.plots[0] = 1;
s.plots[1] = 1;
const mg = Logic.merge(s, 0, 1);
ok('merge same level', mg.ok && mg.newLevel === 2);
ok('merge clears source', mg.state.plots[0] === 0 && mg.state.plots[1] === 2);
ok('merge grants burst dew', mg.state.dew > 0);
const badMerge = Logic.merge(s, 0, 2); // plot 2 empty
ok('merge rejects mismatch', !badMerge.ok);

// --- upgrades ----------------------------------------------------------------
s = Logic.newGame();
s = { ...s, dew: 1e6 };
const up1 = Upgrades.buyUpgrade(s, Config.U.power, 'one');
eq('buy one upgrade level', up1.state.upgrades[Config.U.power], 1);
ok('buy upgrade spends dew', up1.state.dew < 1e6);
const upMax = Upgrades.buyUpgrade(s, Config.U.power, 'max');
ok('buy max buys several levels', upMax.bought > 1, `bought=${upMax.bought}`);

// seed-quality cap and crit cap sanity via derive
s = Logic.newGame();
s = { ...s, upgrades: s.upgrades.slice() };
s.upgrades[Config.U.crit] = 100; // beyond cap
const d = Logic.derive(s);
ok('crit chance capped at 0.5', d.critChance <= 0.5 + 1e-9, `${d.critChance}`);

// plot expansion
s = Logic.newGame();
s = { ...s, dew: 1e9 };
const pl = Upgrades.buyPlot(s);
ok('buy plot unlocks one', pl.ok && pl.state.unlocked === Config.START_PLOTS + 1);

// --- relics ------------------------------------------------------------------
s = Logic.newGame();
s = { ...s, sunCoins: 100 };
const draw = Relics.drawRelic(s);
ok('draw owns a relic', draw.ok && draw.state.relics[draw.index] === 1);
ok('draw spends coins', draw.state.sunCoins === 100 - Config.DRAW_COST);
const buy = Relics.buyRelic(s, Config.R.sun);
ok('buy-unlock owns relic', buy.ok && buy.state.relics[Config.R.sun] === 1);
const upR = Relics.upgradeRelic(buy.state, Config.R.sun);
ok('upgrade owned relic', upR.ok && upR.state.relics[Config.R.sun] === 2);
const badUp = Relics.upgradeRelic(s, Config.R.sun); // not owned
ok('cannot upgrade unowned relic', !badUp.ok);
eq('relic upgrade cost formula', Config.relicUpgradeCost(Config.R.lens, 0), 3);
eq('relic upgrade cost level2', Config.relicUpgradeCost(Config.R.lens, 2), Math.ceil(3 * 1.5 ** 2));

// --- rebirth -----------------------------------------------------------------
s = Logic.newGame();
s = { ...s, maxStage: 20, grewTree: false, sunCoins: 7, lifetimeCoins: 7 };
const preview = Rebirth.rebirthPreview(s);
ok('rebirth preview positive at stage 20', preview > 0, `${preview}`);
const rb = Rebirth.applyRebirth(s);
ok('rebirth grants coins', rb.ok && rb.state.sunCoins === 7 + preview);
ok('rebirth keeps lifetime coins growing', rb.state.lifetimeCoins === 7 + preview);
eq('rebirth resets stage', rb.state.stage, 1);
eq('rebirth resets plots unlocked', rb.state.unlocked, Config.START_PLOTS);
eq('rebirth increments count', rb.state.rebirths, 1);
const noRb = Rebirth.applyRebirth(Logic.newGame());
ok('rebirth blocked before stage 10', !noRb.ok);

// --- offline -----------------------------------------------------------------
s = Logic.newGame();
s.plots[0] = 6;
const off = Logic.offlineEarnings(s, 3600);
ok('offline earnings positive', off > 0, `${off}`);
const offCap = Logic.offlineEarnings(s, 1e9);
approx('offline earnings capped', offCap, Logic.derive(s).passivePerSec * Config.OFFLINE_CAP_SEC * Config.OFFLINE_RATE, 1e-6);

// --- save round-trip + v1 migration + corruption -----------------------------
installLocalStorage();
s = Logic.newGame();
s = { ...s, dew: 5000, stage: 3, maxStage: 7, sunCoins: 12, relics: s.relics.slice() };
s.relics[Config.R.sun] = 4;
s.plots[0] = 5;
Save.writeSave(s, true, 123456);
const loaded = Save.loadSave();
ok('save round-trips dew', loaded && Math.abs(loaded.state.dew - 5000) < 1e-6);
eq('save round-trips stage', loaded.state.stage, 3);
eq('save round-trips relic', loaded.state.relics[Config.R.sun], 4);
eq('save round-trips celebrated', loaded.celebrated, true);

// v1 migration
installLocalStorage();
globalThis.localStorage.setItem(
  'tap-garden.save',
  JSON.stringify({
    v: 1, dew: 777, tapLevel: 6, tapPower: 6, seedsBought: 10,
    plots: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], maxLevel: 3,
    rng: 999, celebrated: false, savedAt: 42,
  }),
);
const mig = Save.loadSave();
ok('v1 migrates dew', mig && mig.state.dew === 777);
eq('v1 migrates tapLevel→power', mig.state.upgrades[Config.U.power], 5);
eq('v1 migrates discovered', mig.state.discovered, 3);
ok('v1 unlocked covers plants', mig.state.unlocked >= 3);

// corrupt save → null (safe reset)
installLocalStorage();
globalThis.localStorage.setItem('tap-garden.save', '{not valid json');
ok('corrupt save loads as null', Save.loadSave() === null);
installLocalStorage();
globalThis.localStorage.setItem('tap-garden.save', JSON.stringify({ v: 2, dew: 'NaN', plots: 'bad' }));
const safe = Save.loadSave();
ok('garbage fields validated', safe && safe.state.dew === 0 && Array.isArray(safe.state.plots));

// Regression coverage: stage chests use the full new-stage passive rate.
s = Logic.newGame(); s.plots[0] = 3;
s = { ...s, stage: 4, maxStage: 4, earned: Config.stageGoal(4) - 0.01 };
const chest = Logic.tap(s);
eq('single stage clear counted', chest.info.stageAdvanced, 1);
approx('chest equals 30 seconds at new stage rate', chest.info.chestDew,
  Config.CHEST_SECONDS * Logic.derive(chest.state).passivePerSec);

// Initial plots form an actual 3×3 in the 4×4 board; locked plots reject actions.
eq('initial 3×3 plot positions', Config.unlockedPlots(9).join(','), '0,1,2,4,5,6,8,9,10');
s = Logic.newGame(); s.plots[0] = 1; s.plots[1] = 1;
ok('cannot move onto locked plot', !Logic.move(s, 0, 3).ok);
ok('out-of-range merge is safe', !Logic.merge(s, -1, 99).ok);
ok('invalid upgrade index is safe', Upgrades.buyUpgrade(s, -1, 'max').bought === 0);

s = { ...s, dew: 1e6, relics: s.relics.slice() }; s.relics[Config.R.can] = 5;
eq('watering can discounts plot costs', Logic.derive(s).nextPlotCost, 180);
eq('plot purchase uses same discounted cost', Upgrades.buyPlot(s).cost, 180);

s = { ...Logic.newGame(), sunCoins: 100, lifetimeCoins: 100 };
const drawn = Relics.drawRelic(s);
eq('spending coins retains lifetime bonus', drawn.state.lifetimeCoins, 100);
approx('lifetime bonus applied to tap', Logic.derive(drawn.state).globalMult,
  1 + Config.LIFETIME_BONUS_PER_COIN * 100);
s = { ...s, relics: Config.RELICS.map(def => def.max) };
ok('all capped relics prevent paid draw', !Relics.drawRelic(s).ok);
s.relics[Config.R.cloud] -= 1;
const lastDraw = Relics.drawRelic(s);
eq('draw excludes every maxed relic', lastDraw.index, Config.R.cloud);
eq('last relic reaches cap', lastDraw.level, Config.RELICS[Config.R.cloud].max);

s = Logic.newGame(); s.plots[0] = 4; s.relics[Config.R.moon] = 30;
approx('moon caps offline yield at 100%', Relics.relicFx.offlineRate(30), 1);
approx('moon increases offline time cap', Logic.offlineEarnings(s, 1e9),
  Logic.derive(s).passivePerSec * (Config.OFFLINE_CAP_SEC + 30 * Config.MOON_CAP_SEC_PER_LEVEL));
s = { ...s, maxStage: 10, maxStageEver: 12, discovered: 6, relics: s.relics.slice() };
s.relics[Config.R.acorn] = 2;
const fresh = Rebirth.applyRebirth(s).state;
approx('acorn gives new-run dew', fresh.dew, Config.ACORN_BASE * Config.ACORN_GROWTH ** 2);
eq('rebirth preserves codex', fresh.discovered, 6);
eq('rebirth preserves best stage', fresh.maxStageEver, 12);
eq('rebirth retains relic levels', fresh.relics.join(','), s.relics.join(','));

installLocalStorage();
localStorage.setItem('tap-garden.save', JSON.stringify({ v: 1, plots: [0,0,0,2], discovered: 7, tapLevel: 2 }));
const positioned = Save.loadSave().state;
eq('v1 plant position retained', positioned.plots[3], 2);
eq('v1 right-edge plant unlocks required expansion', positioned.unlocked, 10);
eq('v1 discovered alias retained', positioned.discovered, 7);
for (const bad of ['null', '[]', '{"v":99}', '{broken']) {
  localStorage.setItem('tap-garden.save', bad);
  ok('unusable save resets safely: ' + bad, Save.loadSave() === null);
}
globalThis.localStorage = { getItem() { throw Error('unavailable'); }, setItem() { throw Error('unavailable'); }, removeItem() { throw Error('unavailable'); } };
ok('unavailable storage reads safely', Save.loadSave() === null);
Save.writeSave(s, false, 123); Save.clearSave();
ok('unavailable storage writes and resets safely', true);

console.log(`\n${passed}/${passed + failed} logic tests passed.`);
if (failed) process.exit(1);
console.log('ALL LOGIC TESTS PASSED');
