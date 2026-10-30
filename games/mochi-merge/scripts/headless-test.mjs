// Headless QA for Mochi Merge. Builds, serves with `vite preview`, drives the
// real game through its public keyboard/pointer API (no private hooks), and
// checks: zero console errors/warnings and zero failed requests, the loading
// a single title screen, a running demo, real gameplay to a result screen, all four
// languages with no text overflow, resize mid-game without reload/state loss,
// and a blocked-image fallback. Screenshots go to qa/. Prints PASS/FAIL.

import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { selectionChecks } from './selection-checks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = Number(process.env.PORT) || 4221;
const BASE_URL = `http://localhost:${PORT}/mochi-merge/`;
const CHROME = '/usr/bin/google-chrome';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log('Building…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });

  console.log('Starting preview…');
  const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--base', '/mochi-merge/'], { cwd: root, stdio: 'ignore' });
  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };

  try {
    const up = await waitForServer(BASE_URL);
    check('preview server is up', up);
    if (!up) return;

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });

    try {
      await selectionChecks(browser, BASE_URL, check);
      await runMain(browser);
      await runFallback(browser);
      await runScenarios(browser);
    } finally {
      await browser.close();
    }
  } finally {
    cleanup();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED');
}

async function runMain(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  const consoleIssues = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') consoleIssues.push(`${type}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleIssues.push('pageerror: ' + err.message));
  page.on('requestfailed', (req) => failedRequests.push(req.url()));
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

  // Preloading automatically reveals the only start screen.
  await page.waitForSelector('.btn--play', { timeout: 20000 });
  check('single title screen after preload; no Enter game layer', await page.$('.btn--enter') === null);
  await auditPair(page, 'title');

  // title demo running
  await page.waitForSelector('.title__content', { timeout: 10000 });
  await page.waitForSelector('.board__tiles .tile', { timeout: 10000 });
  const snap1 = await page.$eval('.board__tiles', (el) => el.innerHTML);
  await sleep(1400);
  const snap2 = await page.$eval('.board__tiles', (el) => el.innerHTML);
  check('title demo is running (board changes over time)', snap1 !== snap2);
  await page.screenshot({ path: join(qa, 'title.png') });

  // start a real game
  await page.focus('.btn--play');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.game .board', { timeout: 10000 });
  await sleep(180);
  check('keyboard Play starts game', await page.$('.title') === null);
  check('first-run coach appears outside board and controls', await page.evaluate(() => {
    const c=document.querySelector('.coach').getBoundingClientRect();
    return ['.board','.controls'].every(s=>{const r=document.querySelector('.game '+s).getBoundingClientRect();return !(c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top);});
  }));
  await shot(page, 'onboarding');
  await auditPair(page, 'play');
  let step2=false;
  for (const key of ['ArrowLeft','ArrowDown','ArrowRight','ArrowUp']) {
    await page.keyboard.press(key);
    if ((await page.$eval('.coach', el=>el.textContent)).includes('Tip 2')) { step2=true; break; }
  }
  check('coach advances after player slides', step2);
  for (let i=0;i<80 && await page.$('.coach__text');i++) await page.keyboard.press(['ArrowDown','ArrowLeft','ArrowUp','ArrowRight'][i%4]);
  check('coach completes after player merges', await page.$('.coach__text') === null && await page.evaluate(()=>localStorage.getItem('mochi.coach')==='done'));
  await page.click('.help-btn');
  check('help reopens coach', await page.$('.coach__text') !== null);
  await page.click('.coach__skip');
  check('coach can be skipped', await page.$('.coach__text') === null);
  const savedBefore=await snapshot(page);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('.btn--play');
  check('reload offers Continue and New game', (await page.$eval('.btn--play',el=>el.textContent))==='Continue' && await page.$('.btn--new') !== null);
  await page.click('.btn--play');
  await page.waitForSelector('.game .board');
  check('reload restores board, score, best, seed, IDs, moves and continuation', (await snapshot(page))===savedBefore);
  check('completed coach stays hidden after reload', await page.$('.coach__text') === null);
  check('each tile retains its art and high-contrast tier number', await page.$$eval('.tile',els=>els.every(el=>el.querySelector('img') && el.querySelector('.tile__number').textContent===el.dataset.tier)));
  const contrast=await page.$eval('.tile__number', el=>{
    const luminance=color=>{
      const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const x=v/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;});
      return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
    };
    const style=getComputedStyle(el),a=luminance(style.color),b=luminance(style.backgroundColor);
    return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  });
  check('tile number contrast meets WCAG AA',contrast>=4.5,contrast.toFixed(2)+':1');
  check('goal progress matches the highest tile reached',await page.evaluate(()=>{
    const highest=Math.max(...[...document.querySelectorAll('.game__board .tile')].map(el=>Number(el.dataset.tier)));
    return document.querySelector('.goal progress').value===Math.min(highest,9);
  }));
  await shot(page, 'reload');

  // mark the window so a reload would be detectable later
  await page.evaluate(() => {
    window.__ALIVE__ = 'yes';
  });

  const readScore = () =>
    page.$eval('.game__hud .pill .pill__value', (el) => Number(el.textContent) || 0);
  const scoreBefore = await readScore();

  // play with keyboard until a result screen appears (cap the moves)
  const dirs = ['ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp'];
  let gotResult = false;
  let moved = false;
  for (let i = 0; i < 1500 && !gotResult; i++) {
    await page.keyboard.press(dirs[i % dirs.length]);
    if (i % 7 === 0) await sleep(16);
    if (i === 24) await page.screenshot({ path: join(qa, 'gameplay.png') }); // mid-game
    const sc = await readScore().catch(() => 0);
    if (sc > scoreBefore) moved = true;
    gotResult = (await page.$('.panel--result')) !== null;
  }
  check('score increased during play', moved, `score before ${scoreBefore}`);
  check('game-over result screen reached', gotResult);
  if (gotResult) {
    await page.screenshot({ path: join(qa, 'result.png') });
    const maxTier=await page.$$eval('.game__board .tile',els=>Math.max(...els.map(el=>Number(el.dataset.tier))));
    const dict=JSON.parse(readFileSync(join(root,'public/config/language/en.json'),'utf8'));
    const highestText=await page.$eval('.panel__highest',el=>el.textContent);
    const bestScore=await page.$$eval('.pill__value',els=>Number(els[1].textContent));
    check('result shows highest tier number, localized name, icon and best score', highestText.includes(String(maxTier)) && highestText.includes(dict.tiers[Math.min(maxTier,9)]) && await page.$('.panel--result .panel__mascot') !== null && await page.$eval('.panel__best',(el,best)=>el.textContent===`Best ${best}`,bestScore));
    check('game over clears saved run', await page.evaluate(()=>localStorage.getItem('mochi.run')===null));
    await auditPair(page,'result');
    await shot(page,'result');
  }

  // restart to get back to a live game for the language/resize checks
  if (gotResult) {
    await page.click('.panel--result .btn--primary');
    await page.waitForSelector('.game .board', { timeout: 10000 });
  }

  // languages: cycle all four, check <html lang> and no text overflow
  const expectLang = { en: 'en', 'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN', ja: 'ja' };
  let langOk = true;
  let overflowOk = true;
  await page.setViewport({width:360,height:640});
  await page.click('.help-btn');
  for (const item of ['en', 'zh-tw', 'zh-cn', 'ja']) {
    await page.click('.game__controls .lang .icon-btn');
    await page.waitForSelector('.lang__menu', { timeout: 5000 });
    // click the specific language by its position in the fixed order
    await page.evaluate((code) => {
      const items = [...document.querySelectorAll('.lang__menu .lang__item')];
      const order = ['en', 'zh-tw', 'zh-cn', 'ja'];
      const idx = order.indexOf(code);
      if (items[idx]) items[idx].click();
    }, item);
    await sleep(120);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    if (htmlLang !== expectLang[item]) {
      langOk = false;
      check(`html lang for ${item}`, false, `got ${htmlLang}`);
    }
    const overflow = await page.evaluate(() => {
      const bad = [];
      const els = document.querySelectorAll(
        '.btn, .pill__value, .pill__label, .panel__title, .lang__item, .title__name, .title__tagline, .loading__pct, .goal__text, .coach__text',
      );
      for (const el of els) {
        if (el.scrollWidth > el.clientWidth + 1)
          bad.push((el.className || el.tagName) + ':' + el.textContent);
      }
      return bad;
    });
    const localized=JSON.parse(readFileSync(join(root,`public/config/language/${item}.json`),'utf8'));
    check(`localized Dragon goal and tier progress (${item})`, await page.$eval('.goal strong',el=>el.textContent) === localized.hud.goal && await page.$('.goal progress') !== null);
    check(`HUD labels ≥18px, numbers ≥20px, buttons ≥48px and fit at 360px (${item})`, await page.evaluate(()=>{
      const labels=[...document.querySelectorAll('.pill__label,.goal__text')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=18);
      const numbers=[...document.querySelectorAll('.pill__value')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=20);
      const buttons=[...document.querySelectorAll('.game button')].every(el=>{const r=el.getBoundingClientRect();return r.width>=48&&r.height>=48&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;});
      return labels&&numbers&&buttons;
    }));
    if (overflow.length) {
      overflowOk = false;
      check(`no text overflow (${item})`, false, overflow.slice(0, 3).join(' | '));
    }
  }
  check('all four languages set <html lang>', langOk);
  check('no text overflow across languages', overflowOk);
  // reset to English for remaining shots
  await page.click('.game__controls .lang .icon-btn');
  await page.waitForSelector('.lang__menu', { timeout: 5000 });
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.lang__menu .lang__item')];
    if (items[0]) items[0].click();
  });
  await sleep(100);

  // resize mid-game: no reload, state survives, controls/board stay on-screen
  const sizes = [
    [375, 812],
    [360, 640],
    [390, 844],
    [844, 390],
    [667, 375],
    [1280, 720],
    [1440, 900],
    [1920, 1080],
    [466, 678],
    [678, 466],
    [626, 890],
    [890, 626],
    [445, 626],
  ];
  const scoreMid = await readScore().catch(() => 0);
  const runMid = await snapshot(page);
  let resizeAlive = true;
  let onScreen = true;
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: w === 390 ? 3 : 1 });
    await sleep(120);
    const alive = await page.evaluate(() => window.__ALIVE__);
    if (alive !== 'yes') resizeAlive = false;
    const clipped = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targets = document.querySelectorAll('.game__board .board, .game__controls .icon-btn, .hud-wrap, .coach');
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) return true;
      }
      return false;
    });
    if (clipped) {onScreen = false;console.log('Clipping at',w,h,await page.evaluate(()=>[...document.querySelectorAll('.game__board .board, .game__controls .icon-btn, .hud-wrap, .coach')].filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(el=>el.className)));}
  }
  check('no reload across resizes (window var survived)', resizeAlive);
  check('game state survived resizes (board, score and move state kept)', (await readScore().catch(() => -1)) === scoreMid && await snapshot(page)===runMid);
  check('board + controls stay within viewport across sizes', onScreen);

  // layout screenshots
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await sleep(150);
  await page.screenshot({ path: join(qa, 'wide.png') });
  await page.setViewport({ width: 626, height: 890, deviceScaleFactor: 1 });
  await sleep(150);
  await page.screenshot({ path: join(qa, 'near-square.png') });

  await page.setViewport({width:375,height:812});
  await shot(page,'portrait');
  await page.setViewport({width:844,height:390});
  await shot(page,'landscape');

  check('no console errors/warnings', consoleIssues.length === 0, consoleIssues.slice(0, 4).join(' | '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 4).join(' | '));

  await page.close();
}

async function runFallback(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  let blockedOne = false;
  page.on('request', (req) => {
    const url = req.url();
    if (!blockedOne && url.includes('icon_mochi_plain.png')) {
      blockedOne = true;
      req.abort();
      return;
    }
    req.continue();
  });
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.btn--play', { timeout: 20000 });
    const titleShown = (await page.waitForSelector('.title__content', { timeout: 10000 })) !== null;
    await page.click('.btn--play');
    await page.waitForSelector('.game .board');
    check('game still starts with a blocked image (fallback)', titleShown && blockedOne);
  } catch (e) {
    check('game still starts with a blocked image (fallback)', false, String(e).slice(0, 120));
  }
  await page.close();
}

const reports = join(root, '..', '_reports');
mkdirSync(reports, { recursive: true });
async function shot(page, name) {
  await sleep(200);
  await page.screenshot({path:join(reports, `fix_mochi-merge_${name}.png`)});
}
async function snapshot(page) {
  return page.evaluate(()=>{
    const r=JSON.parse(localStorage.getItem('mochi.run'));
    if (!r) return null;
    const s=r.state;
    return JSON.stringify([s.grid,s.score,s.seed,s.nextId,s.moves,s.won,s.keepGoing,r.best,r.newBest]);
  });
}
async function auditPair(page, name) {
  const before=page.viewport();
  for(const width of [375,1440]) {
    await page.setViewport({width,height:width===375?812:900,deviceScaleFactor:1});
    await page.evaluate(readFileSync('/workspace/deploy/node_modules/axe-core/axe.min.js','utf8'));
    const issues=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target.join(' '))})));
    check(`axe ${name} ${width}: zero violations`,issues.length===0,JSON.stringify(issues));
  }
  await page.setViewport(before);
}
async function runScenarios(browser) {
  // Exercise the browser language default, rather than only changing the menu.
  for(const [preferences,saved,expected] of [
    [['zh-HK'],null,'zh-TW'],[['zh-Hant-TW'],null,'zh-TW'],[['zh-SG'],null,'zh-CN'],[['zh-Hans'],null,'zh-CN'],[['zh'],null,'zh-CN'],[['ja-JP'],null,'ja'],[['fr','ja'],null,'ja'],[['fr'],null,'en'],[['ja'],'zh-tw','zh-TW'],[['ja'],'invalid','ja']
  ]) {
    const page=await browser.newPage();
    await page.evaluateOnNewDocument((prefs,choice)=>{
      Object.defineProperty(navigator,'languages',{get:()=>prefs});
      localStorage.removeItem('mochi.lang');
      if(choice)localStorage.setItem('mochi.lang',choice);
    },preferences,saved);
    await page.goto(BASE_URL);await page.waitForSelector('.btn--play');
    check(`browser preferences ${preferences} / saved ${saved}`,await page.evaluate(()=>document.documentElement.lang)===expected);
    await page.close();
  }
  // Saved-state fixture enters the normal Continue flow, then real keyboard input wins.
  const page=await browser.newPage();
  await page.evaluateOnNewDocument(()=>{
    window.__starts=0;
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.__starts++;return original.apply(this,args);};
  });
  await page.goto(BASE_URL);await page.waitForSelector('.btn--play');
  check('title is silent before the Play gesture',await page.evaluate(()=>window.__starts===0));
  await page.focus('.btn--play');await page.keyboard.press('Enter');await page.waitForSelector('.game');await sleep(100);
  check('Play keypress unlocks audio and starts preloaded BGM',await page.evaluate(()=>window.__starts>0));
  await page.click('.game__controls .lang .icon-btn');
  await auditPair(page,'language menu');
  await page.keyboard.press('Escape');
  await page.reload();await page.waitForSelector('.btn--play');
  await page.evaluate(()=>{
    const grid=Array.from({length:4},()=>Array(4).fill(null));
    grid[0][0]={id:1,tier:8,row:0,col:0};grid[0][1]={id:2,tier:8,row:0,col:1};
    localStorage.setItem('mochi.run',JSON.stringify({version:1,best:0,newBest:false,state:{grid,ghosts:[],score:0,over:false,won:false,keepGoing:false,seed:42,nextId:3,moves:0}}));
  });
  await page.reload();await page.waitForSelector('.btn--play');await page.click('.btn--play');await page.waitForSelector('.game');
  await page.keyboard.press('ArrowLeft');await page.waitForSelector('.panel--win');
  check('Dragon win clears saved run',await page.evaluate(()=>localStorage.getItem('mochi.run')===null));
  check('Dragon goal progress reaches 9 / 9',await page.$eval('.goal progress',el=>el.value===9));
  await auditPair(page,'win');await shot(page,'win');
  await page.click('.panel--win .btn--primary');
  check('keep-going saves the continued run',await page.evaluate(()=>JSON.parse(localStorage.getItem('mochi.run')).state.keepGoing===true));
  const continued=await snapshot(page);await page.reload();await page.waitForSelector('.btn--play');await page.click('.btn--play');await page.waitForSelector('.game');
  check('reload keeps the win dismissed and restores continued run',await page.$('.panel--win')===null && await snapshot(page)===continued);
  await page.reload();await page.waitForSelector('.btn--new');await page.click('.btn--new');await page.waitForSelector('.game');
  check('New game discards old board and starts a fresh run',await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mochi.run')).state;return s.score===0&&s.moves===0&&!s.won&&s.grid.flat().filter(Boolean).length===2;}));
  await page.reload();await page.waitForSelector('.btn--play');
  await page.evaluate(()=>localStorage.setItem('mochi.run','{bad'));
  await page.reload();await page.waitForSelector('.btn--play');
  check('malformed save resets to Play safely',await page.$eval('.btn--play',el=>el.textContent==='Play') && await page.$('.btn--new')===null && await page.evaluate(()=>localStorage.getItem('mochi.run')===null));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.reload();await page.waitForSelector('.title');
  const still=await page.$eval('.board__tiles',el=>el.innerHTML);await sleep(600);
  check('reduced motion stops ambient title movement',still===await page.$eval('.board__tiles',el=>el.innerHTML));
  await page.click('.btn--play');await page.waitForSelector('.game');
  check('reduced motion removes tile transitions',await page.$eval('.tile',el=>getComputedStyle(el).transitionDuration==='0s'));
  await page.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
