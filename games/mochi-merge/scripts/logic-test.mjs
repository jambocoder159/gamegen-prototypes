import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const moduleURL = path => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const logicURL=moduleURL('src/game/logic.ts');
const {newGame,move,highestTier}=await import(logicURL);
const storageSource=ts.transpileModule(readFileSync('src/game/storage.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./logic'",JSON.stringify(logicURL));
const {saveRun,readRun,RUN_KEY}=await import('data:text/javascript;base64,'+Buffer.from(storageSource).toString('base64'));
const {browserLang}=await import(moduleURL('src/i18n/dict.ts'));
let count=0;
function test(name,fn){fn();count++;console.log('PASS — '+name);}
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
let state=newGame(42);for(const dir of ['left','down','left','up','right'])state=move(state,dir).state;
saveRun(state,state.score,true);const valid=JSON.parse(data.get(RUN_KEY));
test('stable run restores board, score, best, moves and next move deterministically',()=>{
 const saved=readRun();assert(saved);assert.equal(saved.best,state.score);assert.equal(saved.newBest,true);assert.equal(saved.state.moves,state.moves);assert.deepEqual(saved.state.grid.map(r=>r.map(t=>t&&[t.id,t.tier,t.row,t.col])),state.grid.map(r=>r.map(t=>t&&[t.id,t.tier,t.row,t.col])));
 const before=move(state,'down').state,after=move(saved.state,'down').state;
 assert.deepEqual(after.grid,before.grid);assert.equal(after.seed,before.seed);assert.equal(after.nextId,before.nextId);
});
const tilePos=valid.state.grid.flatMap((r,ri)=>r.map((t,ci)=>t&&[ri,ci])).find(Boolean);
const mutations={version:x=>x.version=2,best:x=>x.best=-1,bestBelowScore:x=>x.best=0,newBest:x=>x.newBest='yes',score:x=>x.state.score='10',seed:x=>x.state.seed=2**32,nextId:x=>x.state.nextId=1,moves:x=>x.state.moves=-1,over:x=>x.state.over=true,won:x=>x.state.won=true,keepGoing:x=>x.state.keepGoing=true,grid:x=>x.state.grid=[],row:x=>x.state.grid[0]=[],tileId:x=>x.state.grid[tilePos[0]][tilePos[1]].id=0,tier:x=>x.state.grid[tilePos[0]][tilePos[1]].tier=41,position:x=>x.state.grid[tilePos[0]][tilePos[1]].row=99};
for(const [name,change]of Object.entries(mutations))test('invalid '+name+' safely clears run',()=>{const x=structuredClone(valid);change(x);data.set(RUN_KEY,JSON.stringify(x));assert.equal(readRun(),null);assert.equal(data.has(RUN_KEY),false);});
for(const [name,raw]of [['malformed','{'],['oversize',' '.repeat(12001)]])test(name+' save safely resets',()=>{data.set(RUN_KEY,raw);assert.equal(readRun(),null);assert.equal(data.has(RUN_KEY),false);});
test('duplicate tile IDs rejected',()=>{const x=structuredClone(valid),tiles=x.state.grid.flat().filter(Boolean);tiles[1].id=tiles[0].id;data.set(RUN_KEY,JSON.stringify(x));assert.equal(readRun(),null);});
test('transient animation data is excluded',()=>{saveRun(state,state.score,true);assert.equal(JSON.parse(data.get(RUN_KEY)).state.ghosts.length,0);assert.equal(readRun().state.grid.flat().filter(Boolean).some(t=>t.merged||t.isNew),false);});
test('game-over and win clear saves; keep-going can resume',()=>{
 saveRun({...state,over:true},state.score,false);assert.equal(data.has(RUN_KEY),false);
 const won=structuredClone(state);won.grid.flat().find(Boolean).tier=9;won.won=true;
 saveRun(won,won.score,false);assert.equal(data.has(RUN_KEY),false);
 won.keepGoing=true;saveRun(won,won.score,false);assert.equal(readRun().state.keepGoing,true);assert.equal(highestTier(readRun().state),9);
});
const langCases=[['zh-TW','zh-tw'],['zh-HK','zh-tw'],['zh-MO','zh-tw'],['zh-Hant-HK','zh-tw'],['zh-CN','zh-cn'],['zh-SG','zh-cn'],['zh-Hans-CN','zh-cn'],['zh','zh-cn'],['ja-JP','ja'],['en-US','en'],['fr-FR','en']];
for(const [lang,expected]of langCases)test('browser language '+lang,()=>assert.equal(browserLang([lang]),expected));
test('first supported browser preference wins',()=>{assert.equal(browserLang(['fr','ja','en']),'ja');assert.equal(browserLang(['en','zh-TW']),'en');});
test('denied storage does not break save/load',()=>{globalThis.localStorage={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}};assert.doesNotThrow(()=>saveRun(state,0,false));assert.equal(readRun(),null);});
console.log(`${count}/${count} logic checks passed.`);
