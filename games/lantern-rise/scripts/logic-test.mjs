import assert from 'node:assert/strict';
import { GameSim, CorridorBot, CONFIG, FIXED_DT } from '../src/game/logic.ts';
import { hudCeilingWorldY } from '../src/config/layout.ts';
import { browserLanguage } from '../src/i18n/langs.ts';

for (const [input, expected] of [
  [['zh-TW'], 'zh-TW'], [['zh-HK'], 'zh-TW'], [['zh-MO'], 'zh-TW'], [['zh-Hant-HK'], 'zh-TW'],
  [['zh-CN'], 'zh-CN'], [['zh-SG'], 'zh-CN'], [['zh-Hans-CN'], 'zh-CN'], [['zh'], 'zh-CN'],
  [['ja-JP'], 'ja'], [['fr', 'ja'], 'ja'], [['en-US', 'ja'], 'en'], [['de'], 'en'],
]) assert.equal(browserLanguage(input), expected, input.join(','));
console.log('PASS browser-language mapping and first supported match');

const countdown = new GameSim(5);
countdown.lantern.y = CONFIG.groundY - 22;
countdown.storms.push({ id: 999, x: countdown.lanternWorldX(), y: countdown.lantern.y, hit: false });
for (let i = 0; i < 360; i++) countdown.step(FIXED_DT, false);
assert.equal(countdown.time, 0);
assert.equal(countdown.hits, 0);
assert.equal(countdown.over, false);
assert.equal(countdown.lantern.fuel, 100);
console.log('PASS 3-second countdown freezes physics, hazards and oil');

// No refuel / no hits; continuous thrust is the maximum drain curve.
const noRefuel = new GameSim(1);
let exhaustedAt = 0;
while (!noRefuel.over && noRefuel.time < 30) {
  noRefuel.sparks.length = 0;
  noRefuel.flames.length = 0;
  noRefuel.crows.length = 0;
  noRefuel.storms.length = 0;
  // Spawned ahead, rather than on the lantern, so removing each frame isolates oil.
  noRefuel.step(FIXED_DT, true);
  if (!exhaustedAt && noRefuel.lantern.fuel === 0) exhaustedAt = noRefuel.time;
}
assert.ok(Math.abs(exhaustedAt - 100 / 6) < 0.02, exhaustedAt);
assert.ok(noRefuel.over && noRefuel.time > 18 && noRefuel.time < 20, noRefuel.time);
console.log(`PASS no-refuel hold: oil empty at ${exhaustedAt.toFixed(3)} active seconds, ground at ${noRefuel.time.toFixed(3)} (+3 seconds countdown)`);

let samples = 0;
for (const [w, h, mode] of [[360,640,'portrait'], [390,844,'portrait'], [667,375,'wide'], [844,390,'wide'], [1280,720,'wide'], [626,890,'portrait']]) {
  for (let seed = 1; seed <= 8; seed++) {
    const sim = new GameSim(seed);
    sim.setView(640*w/h, mode === 'portrait' ? .28 : .3, hudCeilingWorldY(mode,w,h));
    sim.reset(seed);
    const bot = new CorridorBot();
    for (let i = 0; i < (240 + CONFIG.countdownSeconds) / FIXED_DT; i++) {
      sim.step(FIXED_DT, bot.decide(sim, FIXED_DT));
      if (i % 60 === 0) for (const item of [...sim.sparks, ...sim.flames]) {
        assert.ok(item.y >= sim.ceilingY + 70 - 1e-8 && item.y <= CONFIG.sparkMaxY, `${mode}: ${item.y}`);
        samples++;
      }
      assert.equal(sim.over, false, `${w}x${h} seed ${seed} over at ${sim.time}`);
      if (i === 1600) {
        const raw = JSON.parse(JSON.stringify(sim.snapshot()));
        const restored = GameSim.restore(raw);
        assert.ok(restored);
        assert.deepEqual(restored.snapshot(), raw);
        const control = GameSim.restore(raw);
        for (let n = 0; n < 1000; n++) {
          const hold = n % 50 < 28;
          restored.step(FIXED_DT, hold);
          control.step(FIXED_DT, hold);
          assert.deepEqual(restored.snapshot(), control.snapshot());
        }
      }
    }
  }
}
console.log(`PASS ${samples} spark/flame y-range samples; 48 perfect-bot runs survive 240 seconds; deterministic restore`);
const valid = JSON.parse(JSON.stringify(new GameSim().snapshot()));
for (const mutate of [
  x => x.version = 2, x => x.rngState = -1, x => delete x.state.p1,
  x => x.state.lantern.fuel = 101, x => x.state.lantern.y = '300',
  x => x.state.sparks[0].taken = 1, x => x.state.sparks[0].x = null,
  x => x.state.nextSpawnX = 4e9, x => x.state.crows = Array(513).fill({}), x => x.state.time = -5,
]) {
  const bad = structuredClone(valid); mutate(bad); assert.equal(GameSim.restore(bad), null);
}
console.log('PASS invalid versions, fields, ranges and oversized arrays rejected');
