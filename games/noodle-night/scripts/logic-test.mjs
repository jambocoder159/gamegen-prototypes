import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'noodle-logic-'));
try {
  for (const name of ['logic', 'storage']) {
    const source = readFileSync(new URL(`../src/game/${name}.ts`, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace("from './logic'", "from './logic.mjs'");
    writeFileSync(join(dir, name + '.mjs'), code);
  }
  const { createGame, patienceFor, comboMultiplier, serve, step, TOPPINGS } = await import(pathToFileURL(join(dir, 'logic.mjs')));
  const { decodeRun, saveRun, loadRun, loadBest, saveBest } = await import(pathToFileURL(join(dir, 'storage.mjs')));
  assert.deepEqual([0,1,2,3,4,5].map(patienceFor), [48,40,32,24,16,15.3]);
  assert.equal(patienceFor(100), 7);
  console.log('PASS N1: introductory patience curve and floor');
  const s = createGame(42);
  const customer = s.customers[0];
  customer.order = ['egg', 'pork'];
  s.combo = 3; s.bestCombo = 3; s.served = 3;
  for (const bowl of [[], ['egg']]) {
    s.bowl = [...bowl];
    assert.equal(serve(s).incomplete, true);
    assert.equal(s.hearts, 3); assert.equal(s.combo, 3); assert.deepEqual(s.bowl, bowl);
    assert.equal(customer.flashTimer, 0); assert.equal(customer.patience, 48);
  }
  console.log('PASS N2: empty and subset bowls preserve lives, combo, toppings and patience');
  s.bowl = ['egg','pork'];
  assert.equal(serve(s).ok, true);
  const full = createGame(8); full.combo = 18; full.bestCombo = 18; full.served = 18;
  full.bowl = [...full.customers[0].order];
  const expected = (full.bowl.length * 10 + 10) * 10;
  assert.equal(serve(full).coins, expected);
  assert.equal(comboMultiplier(19), 10); assert.equal(comboMultiplier(100), 10);
  console.log('PASS N7: multiplier reaches ×10 at 19, stays capped, and multiplies the full score');
  for (const method of ['wrong', 'expiry']) {
    const over = createGame(1); over.hearts = 1;
    if (method === 'wrong') {
      over.bowl = [TOPPINGS.find(t => !over.customers[0].order.includes(t))];
      serve(over);
    } else { over.bowl = ['egg']; over.customers[0].patience = 0.01; step(over, 0.02); }
    assert.equal(over.status, 'over'); assert.deepEqual(over.customers, []); assert.deepEqual(over.bowl, []);
    assert.equal(over.selectedId, null); assert.equal(over.spawnTimer, 0);
  }
  console.log('PASS N5: wrong serve and timeout both clear the stall');
  const valid = createGame(25); valid.bowl = ['egg'];
  const serialize = v => JSON.stringify({ version: 1, state: v });
  assert.deepEqual(decodeRun(serialize(valid)), valid);
  for (const [field, value] of Object.entries({ rng: 2**32, hearts: 4, coins: -1, combo: 0.1, bestCombo: -1, served: '0', elapsed: null, nextId: 0, spawnTimer: 9, bowl: ['egg','egg'], customers: {}, selectedId: 99, seatsOpen: 3, status: 'over' })) {
    assert.equal(decodeRun(serialize({ ...valid, [field]: value })), null, field);
  }
  for (const [field,value] of Object.entries({id:0,animal:'wolf',order:['bad'],patienceMax:99,patience:-1,enteredAt:20,seat:2,phase:'bad',leaveExpr:'wait',leaveTimer:9,flashTimer:9})) {
    assert.equal(decodeRun(serialize({...valid,customers:[{...valid.customers[0],[field]:value}]})),null,field);
  }
  for (const raw of ['{','x'.repeat(16001),JSON.stringify({version:2,state:valid}), 'null']) assert.equal(decodeRun(raw),null);
  const memory = new Map();
  globalThis.localStorage = {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  saveRun(valid); assert.deepEqual(loadRun(),valid);
  saveBest(90); saveBest(20); assert.equal(loadBest(),90);
  memory.set('noodle_night_best','Infinity'); assert.equal(loadBest(),0);
  globalThis.localStorage = {getItem(){throw Error('denied');},setItem(){throw Error('full');},removeItem(){throw Error('denied');}};
  assert.doesNotThrow(()=>saveRun(valid)); assert.doesNotThrow(()=>saveBest(1)); assert.equal(loadRun(),null);
  console.log('PASS C3/N8: version, every persisted field, bounds, bad data, storage failures and best score');
} finally { rmSync(dir, { recursive: true, force: true }); }
