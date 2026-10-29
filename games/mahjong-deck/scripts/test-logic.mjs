// Node unit test for the stage layouts and the deal generator (no browser).
// Imports the production logic, layouts, save validator and language mapper; checks,
// for all five stages:
//   • no two tiles overlap at the same layer / position,
//   • the deal has an even number of tiles per face (whole pairs),
//   • the generated deal is actually clearable by an INDEPENDENT greedy-with-
//     backtracking solver (not the generator's own peel order),
//   • stage 5 fits a 360×640 viewport with tiles ≥ 24px wide (reports the width).
// Run with `npm run test:logic`. Exits non-zero on any failure.

import { buildSync } from 'esbuild';
const bundle = buildSync({ stdin: { contents: "export * from './src/game/logic'; export * from './src/game/layouts'; export * from './src/game/geometry'; export * from './src/game/save'; export * from './src/i18n/dict'", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { generateDeal, freeTiles, getStages, mulberry32, peelOrder, reshuffleTypes, isFree, tileBox: box, BT, validateRun, browserLanguage, dealSeed: runDealSeed } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const overlap = (a,b) => Math.abs(a.x-b.x)<2 && Math.abs(a.y-b.y)<2;
const DEFS = getStages().map(s => ({ K: s.K, layers: [s.positions] }));
const dealSeed = i => Math.imul(0x9e3779b1,i+1) >>> 0;

// ---- independent greedy-with-backtracking solver -------------------------
// DFS over matched pairs with memoisation of dead states; proves the typed deal
// is fully clearable without reusing the generator's peel order.
function solvable(tiles0) {
  const tiles = tiles0.map((t) => ({ ...t }));
  const failed = new Set();
  let nodes = 0;
  const NODE_CAP = 2_000_000;
  const key = () => tiles.filter((t) => !t.removed).map((t) => t.id).join(',');
  function dfs() {
    if (tiles.every((t) => t.removed)) return true;
    if (++nodes > NODE_CAP) return false;
    const k = key();
    if (failed.has(k)) return false;
    const free = freeTiles(tiles);
    // group free tiles by type and try each same-type pair
    const byType = new Map();
    for (const t of free) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(t);
    }
    for (const [, group] of byType) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          group[i].removed = true;
          group[j].removed = true;
          if (dfs()) return true;
          group[i].removed = false;
          group[j].removed = false;
        }
      }
    }
    failed.add(k);
    return false;
  }
  return dfs();
}

// ---- board-scale math (mirror of BoardView, using the shared geometry) ----
function minTileWidth(positions, availW, availH) {
  let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
  for (const p of positions) {
    const b = box(p);
    minL = Math.min(minL, b.left);
    minT = Math.min(minT, b.top);
    maxR = Math.max(maxR, b.right);
    maxB = Math.max(maxB, b.bottom);
  }
  const scale = Math.min(availW / (maxR - minL), availH / (maxB - minT));
  return scale * BT;
}

// ---- run -----------------------------------------------------------------
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
  if (!ok) failures++;
}

for (let i = 0; i < DEFS.length; i++) {
  const { K, layers } = DEFS[i];
  const positions = layers.flat();
  const n = positions.length;

  // 1) no same-z overlaps
  let sameZ = false;
  for (let a = 0; a < n && !sameZ; a++)
    for (let b = a + 1; b < n; b++)
      if (positions[a].z === positions[b].z && overlap(positions[a], positions[b])) { sameZ = true; break; }
  check(`stage ${i + 1}: no same-layer overlaps (${n} tiles)`, !sameZ);

  // 2) deal generates, even pair counts per face
  const deal = generateDeal(positions, K, dealSeed(i));
  check(`stage ${i + 1}: deal generated`, !!deal);
  if (!deal) continue;
  const counts = {};
  for (const t of deal) counts[t.type] = (counts[t.type] || 0) + 1;
  const allEven = Object.values(counts).every((c) => c % 2 === 0);
  check(`stage ${i + 1}: even tile count per face`, allEven, Object.values(counts).join(','));

  // 3) independent solver clears it
  check(`stage ${i + 1}: deal solvable (greedy + backtracking)`, solvable(deal));
}

// 4) stage 5 fits 360×640 with tiles ≥ 24px. Board area ≈ full width minus side
//    padding, height minus HUD + hand + controls rows (conservative estimate).
const s5 = DEFS[4].layers.flat();
const availW = 360 - 16;
const availH = 640 - 56 - 112 - 56 - 28; // hud + hand + controls + gaps
const w = minTileWidth(s5, availW, availH);
check(`stage 5 fits 360×640 with tiles ≥ 24px`, w >= 24, `min tile width ≈ ${w.toFixed(1)}px (board area ${availW}×${availH})`);

// Independently solve 256 random stage-one arrangements using production code.
const variety = new Set();
let valid = true;
for (let i = 0; i < 256; i++) {
  const seed = (Math.imul(i + 1, 0x85ebca77) ^ 0x9e3779b9) >>> 0;
  const stage = getStages()[0];
  const tiles = generateDeal(stage.positions, stage.K, seed);
  if (!tiles || !solvable(tiles)) valid = false;
  variety.add(tiles?.map(t => t.type).join(','));
}
check('stage 1: 256 random seeds independently solvable', valid);
check('stage 1: random arrangements differ', variety.size > 250, `${variety.size} distinct`);
// Every stage also replays the construction witness across 200 random seeds.
for (const stage of getStages()) {
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const seed = Math.imul(i + 7, 0xc2b2ae35) >>> 0;
    const tiles = generateDeal(stage.positions, stage.K, seed);
    const order = peelOrder(stage.positions, mulberry32(seed));
    if (!tiles || !order) { ok = false; break; }
    for (const [a,b] of order) {
      if (!isFree(tiles[a], tiles) || !isFree(tiles[b], tiles) || tiles[a].type !== tiles[b].type) ok = false;
      tiles[a].removed = tiles[b].removed = true;
    }
  }
  check(`stage ${stage.number}: 200 seeds have legal complete solutions`, ok);
}

// Novice policy: choose uniformly among visible legal pairs, with a 5% chance
// of a wrong pair when different faces are free. No lookahead, no other cards.
// Actual auto-shuffle rules: one heart per stuck board; seeded solvable redeal.
function simulate(stage, count) {
  let wins = 0, stucks = 0;
  for (let seed = 1; seed <= count; seed++) {
    const tiles = generateDeal(stage.positions, stage.K, runDealSeed(stage.index, 0, seed));
    const rng = mulberry32(seed ^ 0xabc987);
    let hearts = 3, salt = 1;
    while (tiles.some(t => !t.removed) && hearts > 0) {
      const free = freeTiles(tiles), pairs = [];
      for (let i = 0; i < free.length; i++) for (let j = i+1; j < free.length; j++)
        if (free[i].type === free[j].type) pairs.push([free[i],free[j]]);
      if (!pairs.length) {
        stucks++; hearts--;
        if (hearts && !reshuffleTypes(tiles, stage.K, runDealSeed(stage.index, salt++, seed))) break;
        continue;
      }
      if (rng() < 0.05 && new Set(free.map(t => t.type)).size > 1) { hearts--; continue; }
      pairs[Math.floor(rng()*pairs.length)].forEach(t => { t.removed = true; });
    }
    if (tiles.every(t => t.removed)) wins++;
  }
  return { wins, count, rate: wins/count, stucks };
}
const balance = simulate(getStages()[4], 1000);
check('stage 5: 64 tiles, four layers, 14 faces', getStages()[4].positions.length === 64 && getStages()[4].K === 14);
check('stage 5: novice simulation wins 40–60%', balance.rate >= .4 && balance.rate <= .6, JSON.stringify(balance));
for (const [tags, expected] of [[['fr','zh-Hant-HK'],'zh-tw'],[['zh-HK'],'zh-tw'],[['zh-MO'],'zh-tw'],[['zh-SG'],'zh-cn'],[['zh-Hans-CN'],'zh-cn'],[['zh'],'zh-cn'],[['ja-JP'],'ja'],[['en-US','ja'],'en'],[['fr'],'en']])
  check(`browser language ${tags.join(',')}`, browserLanguage(tags) === expected);
const sample = { phase: 'playing', stageIndex: 0, seed: 42, shuffleCount: 1,
  tiles: generateDeal(getStages()[0].positions, 6, 42), selected: null, hearts: 2, score: 100,
  hand: [{type:'heal',count:1}], combo:1, comboCardLeft:0, wildActive:false, hint:null, rewards:null,
  removedOrder:[], shakeId:0, blockedTapId:null, blockedTapSeq:0, cheer:0 };
check('run save roundtrip', !!validateRun({ version:1,state:sample }));
let rejected = true;
for (const patch of [{seed:-1},{hearts:6},{score:NaN},{stageIndex:5},{hand:[{type:'oops',count:1}]},{tiles:[]},{selected:999},{removedOrder:[0,1]},{wildActive:1},{rewards:['heal']},{hint:[0,999]}]) {
  if (validateRun({version:1,state:{...sample,...patch}})) rejected = false;
}
check('run validator rejects corrupt fields and invalid versions', rejected && !validateRun({version:99,state:sample}));

console.log(`\n${failures === 0 ? 'ALL LOGIC CHECKS PASSED' : failures + ' LOGIC CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
