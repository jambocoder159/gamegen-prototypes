import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { optimalSolution } from './optimal-solver.mjs';
const bundle = await build({ stdin: { contents: `export * from './src/game/logic'; export * from './src/game/levels'; export * from './src/game/solver'; export * from './src/game/run'; export * from './src/i18n/dict';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node' });
const game = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS — ' + name); }
for (const lv of game.getLevels()) test(`level ${lv.number}: solve, win, complete undo`, () => {
  const state = game.newGame(lv.S, lv.K, lv.board);
  const solution = game.solve(lv.board);
  assert(solution?.length);
  for (const move of solution) assert(game.applyMove(state, move.from, move.to).ok);
  assert(game.isWon(state.board));
  while (state.moves) assert(game.undo(state));
  assert.deepEqual(state.board, lv.board);
  assert.deepEqual(state.path, []);
});
for (const [number, optimum, three, two] of [[2, 5, 6, 8], [3, 7, 7, 10], [4, 5, 5, 8]]) test(`level ${number}: proven optimum ${optimum}, star boundaries`, () => {
  const lv = game.getLevel(number - 1);
  assert.equal(optimalSolution(lv.board, optimum - 1), null);
  const solution = optimalSolution(lv.board, optimum);
  assert.equal(solution.length, optimum);
  const state = game.newGame(lv.S, lv.K, lv.board);
  for (const m of solution) assert(game.applyMove(state, m.from, m.to).ok);
  assert(game.isWon(state.board));
  assert.equal(lv.par, optimum);
  assert.deepEqual(lv.budgets, { three, two });
  for (const [moves, stars] of [[optimum, 3], [three, 3], [three + 1, 2], [two, 2], [two + 1, 1]])
    assert.equal(game.starsFor(moves, lv.par, lv.budgets), stars);
});
test('invalid moves leave the entire state unchanged', () => {
  const lv = game.getLevel(0), state = game.newGame(lv.S, lv.K, lv.board);
  const occupied = state.board.flatMap((v, i) => v === null ? [] : [i]);
  const before = structuredClone(state);
  for (const [a,b] of [[occupied[0],occupied[1]],[-1,0],[0,NaN],[0,0.5],[Infinity,0]]) {
    assert.equal(game.applyMove(state,a,b).ok,false);
    assert.deepEqual(state,before);
  }
});
test('browser language first-match mappings', () => {
  for (const [languages, expected] of [ [['fr-FR','zh-HK'],'zh-tw'], [['zh-TW'],'zh-tw'], [['zh-MO'],'zh-tw'], [['zh-Hant-HK'],'zh-tw'], [['zh-CN'],'zh-cn'], [['zh-SG'],'zh-cn'], [['zh-Hans-CN'],'zh-cn'], [['zh'],'zh-cn'], [['ja-JP'],'ja'], [['en-US','ja'],'en'], [['de-DE'],'en'], [[], 'en'] ])
    assert.equal(game.browserLanguage(languages), expected);
});
test('run round trip restores board, moves, selection and undo history', () => {
  const lv = game.getLevel(1), state = game.newGame(lv.S,lv.K,lv.board);
  const first = game.solve(lv.board)[0];
  game.applyMove(state, first.from, first.to);
  const selected = state.board.findIndex(v => v !== null);
  game.saveRun({level:2,state,selected});
  const loaded = game.loadRun();
  assert.deepEqual(loaded, {level:2,state,selected});
  assert(game.undo(loaded.state));
  assert.deepEqual(loaded.state.board,lv.board);
});
test('a lifted item is recoverable before the first move', () => {
  const lv = game.getLevel(0), state = game.newGame(lv.S,lv.K,lv.board);
  const selected = state.board.findIndex(v=>v!==null);
  game.saveRun({level:1,state,selected});
  assert.deepEqual(game.loadRun(),{level:1,state,selected});
});
test('corrupt, oversized, wrong-version, illegal and finished runs safely reset', () => {
  for (const raw of ['{','x'.repeat(200001), 'null', JSON.stringify({version:2,level:1,path:[],selected:null}), ...[0,13,'1',1].map(level => JSON.stringify({version:1,level,path:[{from:0,to:0}],selected:null}))]) {
    memory.set('shelf-sort.run',raw);
    assert.equal(game.loadRun(),null);
    assert(!memory.has('shelf-sort.run'));
  }
  const lv = game.getLevel(0), path = game.solve(lv.board);
  memory.set('shelf-sort.run', JSON.stringify({version:1,level:1,path,selected:null}));
  assert.equal(game.loadRun(),null);
});
test('storage exceptions never prevent play', () => {
  globalThis.localStorage = {getItem(){throw Error('disabled');},setItem(){throw Error('quota');},removeItem(){throw Error('disabled');}};
  assert.equal(game.loadRun(),null);
  const lv=game.getLevel(0), state=game.newGame(lv.S,lv.K,lv.board);
  game.saveRun({level:1,state,selected:null});
  game.clearRun();
});
console.log(`${checks}/${checks} logic checks passed.`);
