// Headless QA for Tap Garden. Builds, serves with `vite preview`, and drives the
// real game through its public pointer/keyboard UI (clicking the pot / plot
// buttons and reading aria-labels + data attributes — no private hooks). Checks:
// zero console errors/warnings and zero failed requests (bar a deliberate 404
// probe), the loading gate + enter, a running title demo, tapping the pot, buying
// seeds, merging two level-1 plants into a level-2, passive income growing dew,
// save persistence across a reload, all four languages with no text overflow,
// resize mid-game without reload/state loss, no clipping/overlap across the
// viewport matrix, a dense grown garden, and a blocked-image fallback.
// Screenshots go to qa/. Prints PASS/FAIL.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = Number(process.env.PORT ?? 4226);
const BASE_URL = `http://localhost:${PORT}/`;
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

// --- DOM readers over the real UI ---------------------------------------------
async function readLevels(page) {
  const rows = await page.$$eval('.garden [data-plot]', (els) =>
    els.map((e) => ({ i: Number(e.dataset.plot), lvl: Number(e.dataset.level) })),
  );
  const out = new Array(16).fill(0);
  for (const { i, lvl } of rows) out[i] = lvl;
  return out;
}
async function readDew(page) {
  return page.$eval('.pill--dew', (el) => Number(el.getAttribute('data-dew')));
}
async function enterAndPlay(page) {
  await page.waitForSelector('.btn--enter', { timeout: 20000 });
  await page.click('.btn--enter');
  await page.waitForSelector('.btn--play', { timeout: 10000 });
  await page.click('.btn--play');
  await page.waitForSelector('.garden .plots__grid .plot', { timeout: 10000 });
  // dismiss an offline greeting if one happens to show
  if (await page.$('.overlay .btn--primary')) {
    await page.click('.overlay .btn--primary').catch(() => {});
  }
}

// pairwise-overlap + inside-viewport audit of plots, pills, pot and control buttons
async function auditLayout(page) {
  return page.evaluate(() => {
    const sel = '.plot, .pill, .pot, .garden__controls .btn, .garden__controls .icon-btn';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rects = [...document.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    let clipped = false;
    for (const r of rects) {
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) clipped = true;
    }
    let overlap = false;
    for (let i = 0; i < rects.length && !overlap; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1 && oy > 1) {
          overlap = true;
          break;
        }
      }
    }
    return { clipped, overlap, count: rects.length };
  });
}

async function main() {
  console.log('Building…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });

  console.log('Starting preview…');
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
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
    if (!up) throw new Error('Preview did not start');

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
    try {
      await runMain(browser);
      await runGrownGarden(browser);
      await runV2(browser);
      await runFixes(browser);
      await runFallback(browser);
      await run404Probe();
      await runSubpath(browser);
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

  await page.waitForSelector('.btn--enter', { timeout: 20000 });
  check('loading screen reached enter button', true);
  await page.screenshot({ path: join(qa, 'loading.png') });
  await page.click('.btn--enter');

  // title demo running (garden changes over time)
  await page.waitForSelector('.title__content', { timeout: 10000 });
  await page.waitForSelector('.title__demo .plots__grid', { timeout: 10000 });
  const snap1 = await page.$eval('.title__demo .plots__grid', (el) => el.innerHTML);
  await sleep(1600);
  const snap2 = await page.$eval('.title__demo .plots__grid', (el) => el.innerHTML);
  check('title demo is running (garden changes over time)', snap1 !== snap2);
  await page.screenshot({ path: join(qa, 'title.png') });

  // start a real game
  await page.click('.btn--play');
  await page.waitForSelector('.garden .plots__grid .plot', { timeout: 10000 });
  await page.evaluate(() => {
    window.__ALIVE__ = 'yes';
  });

  // tap the pot ≥ 12 times
  for (let i = 0; i < 30; i++) {
    await page.click('.pot');
    await sleep(12);
  }
  const dewAfterTaps = await readDew(page);
  check('tapping the pot earns dew', dewAfterTaps >= 12, `dew=${dewAfterTaps}`);
  await page.screenshot({ path: join(qa, 'gameplay.png') });

  // buy 2 seeds via the button
  await page.click('.btn--buy');
  await sleep(80);
  await page.click('.btn--buy');
  await sleep(80);
  const seeds = (await readLevels(page)).filter((v) => v >= 1).length;
  check('bought 2 seeds via the button', seeds >= 2, `plants=${seeds}`);

  // merge two level-1 plants (located via their data-level)
  const levels = await readLevels(page);
  const ones = [];
  for (let i = 0; i < levels.length; i++) if (levels[i] === 1) ones.push(i);
  let mergedOk = false;
  if (ones.length >= 2) {
    await page.click(`.garden [data-plot="${ones[0]}"]`);
    await sleep(60);
    await page.click(`.garden [data-plot="${ones[1]}"]`);
    await sleep(120);
    const after = await readLevels(page);
    mergedOk = after.some((v) => v === 2);
  }
  check('merged two level-1 plants into a level-2', mergedOk);

  // passive income grows dew over ~3s
  const dew0 = await readDew(page);
  await sleep(3200);
  const dew1 = await readDew(page);
  check('passive income increases dew over time', dew1 > dew0, `${dew0} -> ${dew1}`);

  // save + reload: the merged garden must persist
  const beforeSig = (await readLevels(page)).join(',');
  await sleep(5100); // allow the public autosave interval to complete
  await page.reload({ waitUntil: 'networkidle0' });
  await enterAndPlay(page);
  // the reload cleared window state — re-mark so the resize test can detect reloads
  await page.evaluate(() => {
    window.__ALIVE__ = 'yes';
  });
  const afterSig = (await readLevels(page)).join(',');
  const hadTwo = afterSig.split(',').some((v) => Number(v) === 2);
  check('save persisted across reload (board restored)', afterSig === beforeSig && hadTwo,
    `before=${beforeSig} after=${afterSig}`);

  // languages: cycle all four, check <html lang> and no text overflow
  const expectLang = { en: 'en', 'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN', ja: 'ja' };
  let langOk = true;
  let overflowOk = true;
  for (const item of ['en', 'zh-tw', 'zh-cn', 'ja']) {
    await page.click('.garden__controls .lang .icon-btn');
    await page.waitForSelector('.lang__menu', { timeout: 5000 });
    await page.evaluate((code) => {
      const items = [...document.querySelectorAll('.lang__menu .lang__item')];
      const order = ['en', 'zh-tw', 'zh-cn', 'ja'];
      const idx = order.indexOf(code);
      if (items[idx]) items[idx].click();
    }, item);
    await sleep(140);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    if (htmlLang !== expectLang[item]) {
      langOk = false;
      check(`html lang for ${item}`, false, `got ${htmlLang}`);
    }
    const overflow = await page.evaluate(() => {
      const bad = [];
      const els = document.querySelectorAll(
        '.btn, .btn__cost, .pill__value, .pill__label, .panel__title, .lang__item, .title__name, .title__tagline, .loading__pct',
      );
      for (const el of els) {
        if (el.scrollWidth > el.clientWidth + 1) bad.push((el.className || el.tagName) + ':' + el.textContent);
      }
      return bad;
    });
    if (overflow.length) {
      overflowOk = false;
      check(`no text overflow (${item})`, false, overflow.slice(0, 3).join(' | '));
    }
  }
  check('all four languages set <html lang>', langOk);
  check('no text overflow across languages', overflowOk);
  // back to English
  await page.click('.garden__controls .lang .icon-btn');
  await page.waitForSelector('.lang__menu', { timeout: 5000 });
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.lang__menu .lang__item')];
    if (items[0]) items[0].click();
  });
  await sleep(120);

  // resize mid-game: no reload, state survives, nothing clipped/overlapping
  const sizes = [
    [375, 812], [360, 640], [390, 844], [844, 390], [1280, 720],
    [1920, 1080], [466, 678], [678, 466], [626, 890], [890, 626], [445, 626],
  ];
  const before = (await readLevels(page)).join(',');
  let resizeAlive = true;
  let stateOk = true;
  let onScreen = true;
  let noOverlap = true;
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: w === 390 ? 3 : 1 });
    await sleep(160);
    if ((await page.evaluate(() => window.__ALIVE__)) !== 'yes') resizeAlive = false;
    if ((await readLevels(page)).join(',') !== before) stateOk = false;
    const a = await auditLayout(page);
    if (a.clipped) {
      onScreen = false;
      check(`nothing clipped at ${w}x${h}`, false);
    }
    if (a.overlap) {
      noOverlap = false;
      check(`no overlap at ${w}x${h}`, false);
    }
  }
  check('no reload across resizes (window var survived)', resizeAlive);
  check('game state survived resizes (board unchanged)', stateOk);
  check('plots/pills/buttons stay within viewport across sizes', onScreen);
  check('no pairwise overlap of plots/pills/buttons across sizes', noOverlap);

  // layout screenshots
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await sleep(180);
  await page.screenshot({ path: join(qa, 'wide.png') });
  await page.setViewport({ width: 626, height: 890, deviceScaleFactor: 1 });
  await sleep(180);
  await page.screenshot({ path: join(qa, 'near-square.png') });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await sleep(180);
  await page.screenshot({ path: join(qa, 'portrait.png') });

  check('no console errors/warnings', consoleIssues.length === 0, consoleIssues.slice(0, 4).join(' | '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 4).join(' | '));
  await page.close();
}

// A dense, fully grown garden (all tiers discovered) at a small viewport must fit
// with no clipping or overlap.
async function runGrownGarden(browser) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem(
        'tap-garden.save',
        JSON.stringify({
          v: 1,
          dew: 123456,
          tapLevel: 8,
          tapPower: 8,
          seedsBought: 40,
          plots: [9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8],
          maxLevel: 9,
          rng: 12345,
          celebrated: true,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
  });
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await enterAndPlay(page);
  await sleep(250);
  const filled = (await readLevels(page)).filter((v) => v > 0).length;
  check('grown garden restored (16 plants)', filled === 16, `filled=${filled}`);
  const a = await auditLayout(page);
  check('grown garden at 360x640: nothing clipped', !a.clipped);
  check('grown garden at 360x640: no overlap', !a.overlap, `${a.count} elements`);
  await page.screenshot({ path: join(qa, 'grown-garden.png') });
  await page.close();
}

async function runFallback(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  let blocked = 0;
  page.on('request', (req) => {
    if (req.url().includes('icon_plant_1.png')) {
      blocked += 1;
      req.abort();
      return;
    }
    req.continue();
  });
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.btn--enter', { timeout: 20000 });
    await page.click('.btn--enter');
    const titleShown = (await page.waitForSelector('.title__content', { timeout: 10000 })) !== null;
    check('game still starts with a blocked image (fallback)', titleShown && blocked > 0);
  } catch (e) {
    check('game still starts with a blocked image (fallback)', false, String(e).slice(0, 120));
  }
  await page.close();
}

// A 404 for a missing asset must be observable (and the game must not request it
// in normal play — this is a deliberate probe, not a real dependency).
async function run404Probe() {
  try {
    // Accept an image so the SPA html-fallback does not mask the missing file.
    const res = await fetch(BASE_URL + 'common/textures/does_not_exist.png', {
      headers: { Accept: 'image/png,image/*' },
    });
    check('404 probe returns not-found for a missing asset', res.status === 404, `status=${res.status}`);
  } catch (e) {
    check('404 probe returns not-found for a missing asset', false, String(e).slice(0, 80));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function setLanguage(page, code) {
  await page.click('.garden__controls .lang .icon-btn');
  await page.waitForSelector('.lang__menu');
  // The language controls are real buttons; select by their localized text.
  const labels = { en: 'English', 'zh-tw': '繁體中文', 'zh-cn': '简体中文', ja: '日本語' };
  await page.evaluate((label) => {
    [...document.querySelectorAll('.lang__item')].find(el => el.textContent === label)?.click();
  }, labels[code]);
  await sleep(120);
}

async function auditDialog(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role=dialog]');
    const body = dialog.querySelector('.dialog__body');
    const rect = dialog.getBoundingClientRect();
    const overflow = [...dialog.querySelectorAll('*')].filter(el =>
      !el.classList.contains('sr-only') && el.clientWidth > 0 &&
      el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto'
    ).map(el => el.className + ':' + el.textContent.slice(0,80));
    const unreachable = [...body.querySelectorAll('button')].filter(el => {
      const r = el.getBoundingClientRect(), b = body.getBoundingClientRect();
      return r.left < b.left - 1 || r.right > b.right + 1;
    }).map(el => el.className);
    return { inside: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      scrollable: body.scrollHeight <= body.clientHeight + 1 || getComputedStyle(body).overflowY === 'auto',
      overflow, unreachable };
  });
}

async function runV2(browser) {
  const page = await browser.newPage();
  const issues = [];
  page.on('pageerror', err => issues.push(err.message));
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) issues.push(msg.text()); });
  const seed = { v:2, dew:1000, plots:Array(16).fill(0), upgrades:Array(8).fill(0),
    unlocked:9, stage:1, maxStage:1, maxStageEver:1, discovered:0, relics:Array(12).fill(0),
    sunCoins:0, lifetimeCoins:0, rebirths:0, seedsBought:0, earned:0, rng:12345, celebrated:false };
  async function load(payload, dismiss = true) {
    await page.goto(BASE_URL, { waitUntil:'networkidle0' });
    await page.evaluate(payload => {
      localStorage.clear();
      localStorage.setItem('tap-garden.save', typeof payload === 'string' ? payload : JSON.stringify({...payload, savedAt:Date.now()}));
    }, payload);
    await page.reload({ waitUntil:'networkidle0' });
    if (dismiss) await enterAndPlay(page);
    else {
      await page.waitForSelector('.btn--enter'); await page.click('.btn--enter');
      await page.waitForSelector('.btn--play'); await page.click('.btn--play');
      await page.waitForSelector('[role=dialog]');
    }
  }
  await page.setViewport({width:375,height:812});
  await load(seed);
  await page.click('.btn--upgrades');
  await page.waitForSelector('.dialog--upgrades');
  check('dialog receives first focus', await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)));
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  check('Shift-Tab traps at last dialog control', await page.evaluate(() => document.activeElement === [...document.querySelectorAll('[role=dialog] button')].at(-1)));
  await page.keyboard.press('Tab');
  check('Tab wraps to first dialog control', await page.evaluate(() => document.activeElement === document.querySelector('.dialog__close')));
  const dew = await readDew(page);
  await page.click('.urow:first-child .urow__buy');
  await page.click('.urow:first-child .urow__buy');
  check('Pot Power bought twice: level rises and dew drops',
    (await page.$eval('.urow:first-child .urow__level', el=>el.textContent)).includes('2') && await readDew(page) === dew - 33);
  await page.$eval('.urow--plot .urow__buy', el=>el.scrollIntoView({block:'center'}));
  await page.click('.urow--plot .urow__buy');
  check('plot expansion purchased in dialog', (await page.$eval('.urow--plot .urow__level',el=>el.textContent)).includes('10'));
  await page.keyboard.press('Escape');
  check('Escape closes dialog and restores opener focus', await page.evaluate(() => !document.querySelector('[role=dialog]') && document.activeElement.matches('.btn--upgrades')));
  check('plot expansion unlocks a real plot', await page.$$eval('.garden .plot[data-locked]',els=>els.length)===6);

  for (const [amount,suffix] of [[12500,'K'],[1250000,'M']]) {
    await load({...seed,dew:amount});
    check(`large balances display ${suffix}`, (await page.$eval('.pill--dew .pill__value',el=>el.textContent)).includes(suffix));
  }
  await load({...seed,dew:1e8,stage:10,maxStage:10,maxStageEver:10,discovered:4,
    plots:[4,...Array(15).fill(0)],sunCoins:40,lifetimeCoins:40});
  await page.click('.btn--rebirth');
  await page.waitForSelector('.rebirth__amount');
  check('late-game save shows coin preview', await page.$eval('.rebirth__amount',el=>el.textContent)==='30');
  await page.click('.rebirth__confirm');
  check('rebirth confirms and resets stage', (await page.$eval('.stagebar__label',el=>el.textContent))==='Stage 1');
  await page.click('.btn--relics');
  check('rebirth coins available and 12-card codex visible', await page.$eval('.rdlg__coin-n',el=>el.textContent)==='70' && await page.$$eval('.codex__card',els=>els.length)===12);
  await page.click('.rdlg__draw');
  check('draw spends 8 coins and reveals owned relic with level', await page.$eval('.rdlg__coin-n',el=>el.textContent)==='62' && await page.$$eval('.codex__lvl',els=>els.some(el=>el.textContent==='1')));
  await page.click('.rdetail__action');
  check('relic upgrade raises its level', await page.$$eval('.codex__lvl',els=>els.some(el=>el.textContent==='2')));
  await page.click('.codex__card--locked');
  await page.click('.rdetail__action');
  check('targeted buy unlocks another relic', await page.$$eval('.codex__lvl',els=>els.length)===2);
  await page.keyboard.press('Escape');
  const axePath='/workspace/deploy/node_modules/axe-core/axe.min.js';
  if (!existsSync(axePath)) console.log('SKIP — axe-core unavailable at '+axePath);
  for (const [width,height] of [[375,812],[1440,900]]) {
    await page.setViewport({width,height}); await sleep(180);
    if (existsSync(axePath)) {
      await page.addScriptTag({path:axePath});
      for (const dialog of ['garden','upgrades','relics','rebirth']) {
        if (dialog!=='garden') { await page.click('.btn--'+dialog); await page.waitForSelector('[role=dialog]'); }
        const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
        check(`axe zero violations: ${dialog} at ${width}`,violations.length===0,JSON.stringify(violations));
        if(dialog!=='garden') await page.keyboard.press('Escape');
      }
    }
  }
  for (const code of ['en','zh-tw','zh-cn','ja']) {
    await setLanguage(page,code);
    for(const [width,height] of [[375,812],[1440,900],[360,640],[844,390]]) {
      await page.setViewport({width,height}); await sleep(160);
      for (const dialog of ['upgrades','relics','rebirth']) {
        await page.click('.btn--'+dialog); await page.waitForSelector('[role=dialog]');
        if(dialog==='relics') await page.click('.codex__card');
        const a=await auditDialog(page);
        check(`dialog fits: ${code} ${dialog} ${width}x${height}`, a.inside && a.scrollable && !a.overflow.length && !a.unreachable.length,JSON.stringify(a));
        if(width===375 || width===1440) await page.screenshot({path:join(qa,`${dialog}-${code}-${width}.png`)});
        await page.keyboard.press('Escape');
      }
    }
  }
  // v1 migration (including noncontiguous plant positions) and corrupted saves.
  await load({v:1,dew:777,tapLevel:6,plots:[0,2,...Array(13).fill(0),3],maxLevel:5,seedsBought:10});
  check('v1 migration preserves dew and plant positions', await readDew(page)>=777 && (await readLevels(page))[1]===2 && (await readLevels(page))[15]===3);
  await page.click('.btn--upgrades');
  check('v1 tapLevel migrates to equivalent Pot Power level', (await page.$eval('.urow:first-child .urow__level',el=>el.textContent)).includes('5'));
  await page.keyboard.press('Escape');
  for (const payload of ['{broken', JSON.stringify({v:2,dew:'bad',plots:'bad',relics:[-1,null,'oops']})]) {
    await load(payload);
    await page.click('.pot');
    check('corrupted save safely loads playable fresh garden', await readDew(page)>=1 && (await readLevels(page)).every(v=>v===0));
  }
  // A win is a one-time result overlay; continue returns to the endless garden.
  await load({...seed,discovered:9,plots:[9,...Array(15).fill(0)],celebrated:false}, false);
  check('Golden World Tree result is reachable', await page.$eval('.panel__tree', el => el.tagName === 'IMG'));
  await page.screenshot({path:join(qa,'result.png')});
  const resultViewport = page.viewport();
  for (const [width, height] of [[844, 390], [667, 375]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await sleep(150);
    const fits = await page.evaluate(() => {
      const dialog = document.querySelector('[role=dialog]');
      const body = dialog.querySelector('.dialog__body');
      return body.scrollHeight <= body.clientHeight + 1 &&
        [...dialog.querySelectorAll('button, .panel__mascot, .panel__tree')].every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        });
    });
    check(`celebration art and controls fit ${width}x${height} without scrolling`, fits);
    await page.screenshot({ path: join(qa, `result-${width}x${height}.png`) });
  }
  await page.setViewport(resultViewport);
  await sleep(150);
  await page.click('.panel__actions .btn--primary');
  check('celebration continues into endless garden', !(await page.$('[role=dialog]')) && (await readLevels(page))[0]===9);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  check('reduced-motion preference is active', await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
  check('v2 scenarios: no console errors/warnings',issues.length===0,issues.slice(0,5).join(' | '));
  await page.close();
}

async function runSubpath(browser) {
  const mount = '/tap-garden/';
  const types = {html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',png:'image/png',webp:'image/webp',mp3:'audio/mpeg'};
  const server = createServer((req,res) => {
    const path = new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith(mount)) { res.writeHead(404); res.end(); return; }
    const relative = path.slice(mount.length) || 'index.html';
    try {
      const data=readFileSync(join(root,'dist',relative));
      res.setHeader('Content-Type',types[relative.split('.').at(-1)] || 'application/octet-stream');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const page=await browser.newPage(); const issues=[];
  page.on('pageerror',e=>issues.push(e.message));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type())) issues.push(msg.text());});
  page.on('requestfailed',req=>issues.push(req.url()));
  try {
    await page.setViewport({width:390,height:844});
    await page.goto(`http://127.0.0.1:${server.address().port}${mount}`,{waitUntil:'networkidle0'});
    await enterAndPlay(page); await page.click('.pot');
    check('ZIP works from an isolated sub-path with no root assets',await readDew(page)===1 && issues.length===0,issues.join(' | '));
  } finally { await page.close(); await new Promise(resolve=>server.close(resolve)); }
}

// Regression scenarios for the playtest fixes; all mutations use public UI or
// validated save fixtures. No private game hooks.
async function runFixes(browser) {
  const reports = join(root, '..', '_reports'); mkdirSync(reports,{recursive:true});
  const page = await browser.newPage(); const issues=[];
  page.on('pageerror',e=>issues.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type())) issues.push(m.text());});
  const seed={v:2,dew:1000,plots:Array(16).fill(0),upgrades:Array(8).fill(0),unlocked:9,stage:1,maxStage:1,discovered:0,relics:Array(12).fill(0),rng:12345,celebrated:true};
  async function load(payload=seed,{fresh=false,away=0}={}) {
    await page.goto(BASE_URL,{waitUntil:'networkidle0'});
    await page.evaluate(({payload,fresh,away})=>{
      localStorage.clear(); localStorage.setItem('tap-garden.lang','en');
      if(!fresh) { localStorage.setItem('tap-garden.coach','done'); localStorage.setItem('tap-garden.save',JSON.stringify({...payload,savedAt:Date.now()-away*1000})); }
    },{payload,fresh,away});
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForSelector('.btn--enter'); await page.click('.btn--enter');
    await page.waitForSelector('.btn--play');
  }
  async function play(){ await page.click('.btn--play'); await page.waitForSelector('.garden .plot'); }
  async function axe(name) {
    const path='/workspace/deploy/node_modules/axe-core/axe.min.js';
    if(!existsSync(path)) throw new Error('Required axe-core is missing');
    await page.addScriptTag({path});
    const v=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
    check('axe zero violations: '+name,v.length===0,JSON.stringify(v));
  }
  await page.setViewport({width:375,height:812});
  await load(seed,{fresh:true}); await play();
  check('first-run coach is visible and does not block pot', await page.$eval('.coach',e=>!!e) && await page.evaluate(()=>{const a=document.querySelector('.coach').getBoundingClientRect(),b=document.querySelector('.pot').getBoundingClientRect();return a.right<=b.left || a.bottom<=b.top || a.left>=b.right;}));
  await page.screenshot({path:join(reports,'fix_tap-garden_onboarding.png')});
  for(let i=0;i<10;i++) await page.click('.pot');
  await page.waitForFunction(()=>document.querySelector('.coach p')?.textContent.includes('two seeds'));
  check('coach advances after tapping', (await page.$eval('.coach p',e=>e.textContent)).includes('two seeds'));
  for(let i=0;i<15;i++) await page.click('.pot');
  await page.click('.btn--buy'); await page.click('.btn--buy');
  await page.waitForFunction(()=>document.querySelector('.coach p')?.textContent.includes('matching'));
  check('coach advances after buying two seeds',(await page.$eval('.coach p',e=>e.textContent)).includes('matching'));
  const pair=await page.$$eval('.plot[data-level="1"]',els=>els.map(e=>e.dataset.plot));
  const oldRate=await page.$eval('.pill--rate .pill__value',e=>e.textContent);
  await page.click(`[data-plot="${pair[0]}"]`);await page.click(`[data-plot="${pair[1]}"]`);
  check('merge visibly increases per-second pill',oldRate!==await page.$eval('.pill--rate .pill__value',e=>e.textContent));
  await page.waitForFunction(()=>!document.querySelector('.coach'));
  check('coach completes after merge',!(await page.$('.coach')));
  await page.reload({waitUntil:'networkidle0'});await enterAndPlay(page);
  check('completed onboarding stays dismissed after reload',!(await page.$('.coach')));
  check('in-progress save resumes immediately after moves',(await readLevels(page)).some(l=>l===2));
  await page.click('.btn--help');check('help reopens the coach',!!(await page.$('.coach')));await page.click('.coach__skip');
  await page.click('.btn--stats');await page.waitForSelector('.dialog--stats');
  check('statistics shows changed taps, dew and merge counts',await page.$eval('[data-stat=taps]',e=>+e.textContent)>=25 && await page.$eval('[data-stat=merges]',e=>+e.textContent)===1 && await page.$eval('[data-stat=dew]',e=>+e.textContent)>0);
  await page.screenshot({path:join(reports,'fix_tap-garden_stats.png')});await page.keyboard.press('Escape');
  const levels=Array(16).fill(0); for(const i of [0,1,2,4,5,6,8,9,10]) levels[i]=1;
  await load({...seed,plots:levels,stage:2,maxStage:2});await play();
  check('full garden offers Merge all on seed button',(await page.$eval('.btn--buy',e=>e.textContent)).includes('Merge all'));
  await page.click('.btn--settings');await page.click('.auto-merge-switch');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelectorAll('.plot[data-level="2"]').length>=4);
  check('auto merge frees full garden without manual selection',(await readLevels(page)).filter(l=>l===2).length===4);
  await page.reload({waitUntil:'networkidle0'});await enterAndPlay(page);await page.click('.btn--settings');
  check('auto merge choice persists',await page.$eval('.auto-merge-switch',e=>e.checked));
  await page.keyboard.press('Escape');
  await load({...seed,plots:levels});await play();await page.click('.btn--buy');
  check('manual Merge all performs one pass',(await readLevels(page)).filter(l=>l===2).length===4);
  await load(seed);await play();
  check('next locked plot shows price and affordable highlight',await page.$eval('[data-plot="3"]',e=>e.classList.contains('plot--affordable') && e.textContent.includes('200')));
  const before=await readDew(page);await page.click('[data-plot="3"]');
  check('tapping affordable lock buys that plot',await page.$eval('[data-plot="3"]',e=>!e.dataset.locked) && await readDew(page)===before-200);
  await page.click('.btn--upgrades');check('Plots upgrade stays consistent with direct purchase',(await page.$eval('.urow--plot .urow__level',e=>e.textContent)).includes('10'));await page.keyboard.press('Escape');
  const plants=[1,1,2,0,3,2,1,...Array(9).fill(0)];
  await load({...seed,plots:plants});await play();
  await page.waitForSelector('.plant-float');
  check('plants show bounded production numbers',await page.$$eval('.plant-float',els=>els.length>0 && els.length<=3 && els.every(e=>e.textContent.startsWith('+'))));
  await page.click('.btn--settings');
  check('floating numbers accessible switch defaults on',await page.$eval('.floating-switch',e=>e.checked && e.getAttribute('role')==='switch'));
  await page.click('.floating-switch');await page.keyboard.press('Escape');
  check('floating-number switch hides production cues',await page.$$eval('.plant-float,.pot__float',els=>els.length)===0);
  await page.reload({waitUntil:'networkidle0'});await enterAndPlay(page);await page.click('.btn--settings');
  check('floating-number setting persists after reload',!(await page.$eval('.floating-switch',e=>e.checked)));await page.keyboard.press('Escape');
  const many=Array(16).fill(1);await load({...seed,plots:many,unlocked:16});await play();
  await page.waitForFunction(()=>[...document.querySelectorAll('.plant-float')].some(e=>e.textContent.includes('Σ')));
  check('dense garden aggregates production numbers',await page.$$eval('.plant-float',els=>els.length<=3));
  const up=Array(8).fill(0);up[4]=40;
  await load({...seed,upgrades:up});await play();
  await page.waitForSelector('.pot__float');
  check('Auto Tap animates and shows dew without manual taps',await page.$eval('.pot__img',e=>!e.src.includes('_1.png')) || !!(await page.$('.pot__float')));
  await sleep(1200);check('auto visuals stay bounded',await page.$$eval('.pot__float',els=>els.length<=4));
  up[2]=40;up[3]=10;
  await load({...seed,upgrades:up});await play();
  for(let i=0;i<12 && !(await page.$('.pot--crit'));i++) await page.click('.pot');
  check('crit displays distinct gold number and star burst',!!(await page.$('.pot__burst .art')) && !!(await page.$('.pot__float--crit')));
  await page.screenshot({path:join(reports,'fix_tap-garden_crit.png')});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  check('reduced motion removes crit shake, flash and floating movement',await page.evaluate(()=>getComputedStyle(document.querySelector('.pot__img')).animationName==='none' && getComputedStyle(document.querySelector('.garden'),'::after').display==='none' && [...document.querySelectorAll('.pot__float,.plant-float')].every(e=>getComputedStyle(e).animationName==='none')));
  await page.emulateMediaFeatures([]);
  const moon=Array(12).fill(0);moon[2]=5;
  for(const [width,height] of [[375,812],[1440,900]]) {
    await page.setViewport({width,height});await load({...seed,plots:[3,...Array(15).fill(0)],relics:moon},{away:3600});
    await axe(`title ${width}`);await play();await page.waitForSelector('[role=dialog]');
    check(`offline dialog includes relic-adjusted ratio at ${width}`,(await page.$eval('[role=dialog] .offline-ratio',e=>e.textContent)).includes('65%') && (await page.$eval('[role=dialog] .offline-ratio',e=>e.textContent)).includes('3.67'));
    await axe(`offline ${width}`);await page.screenshot({path:join(reports,`fix_tap-garden_offline_${width}.png`)});await page.keyboard.press('Escape');
    for(const dialog of ['stats','settings']) {await page.click('.btn--'+dialog);await axe(`${dialog} ${width}`);await page.keyboard.press('Escape');}
    await page.click('.btn--reset');await axe(`reset ${width}`);await page.keyboard.press('Escape');
    await load({...seed,plots:[9,...Array(15).fill(0)],discovered:9,celebrated:false});await play();await page.waitForSelector('.panel__tree');await axe(`celebration ${width}`);await page.keyboard.press('Escape');
  }
  await load({...seed,plots:[3,...Array(15).fill(0)],relics:moon});await play();
  for(const lang of ['en','zh-tw','zh-cn','ja']) {
    await page.setViewport({width:360,height:640});await setLanguage(page,lang);
    check(`small-phone HUD at ${lang} has no text overflow`,await page.evaluate(()=>[...document.querySelectorAll('.garden__controls button,.pill__label,.pill__value,.stagebar')].every(e=>e.scrollWidth<=e.clientWidth+1)));
    check(`HUD numbers and labels are readable at ${lang}`,await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.pill__value')).fontSize)>=20 && [...document.querySelectorAll('.pill__label,.stagebar__label,.stagebar__amount')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=18)));
    for(const dialog of ['stats','settings']) {await page.click('.btn--'+dialog);const a=await auditDialog(page);check(`new dialog fits ${lang} ${dialog} at 360`,a.inside && !a.overflow.length && !a.unreachable.length);await page.keyboard.press('Escape');}
    await page.click('.btn--settings');check(`offline ratio is localized in ${lang}`,!(await page.$eval('.dialog--settings .offline-ratio',e=>e.textContent)).includes('extra.') && (await page.$eval('.dialog--settings .offline-ratio',e=>e.textContent)).includes('65'));await page.keyboard.press('Escape');
  }
  await setLanguage(page,'en');
  for(const [width,height] of [[375,812],[360,640],[390,844],[445,626],[466,678],[667,375],[844,390],[1440,900]]) {
    await page.setViewport({width,height});await sleep(180);
    const a=await auditLayout(page);
    check(`fixed garden fits ${width}x${height}`,!a.clipped && !a.overlap);
    if(height>width && width<=466) check(`primary pot is at least 40% viewport at ${width}`,await page.$eval('.pot__img',(e,w)=>e.getBoundingClientRect().width>=w*.4-1,width));
    if(height>width) check(`pot is above plots at ${width}`,await page.evaluate(()=>document.querySelector('.pot').getBoundingClientRect().bottom<=document.querySelector('.plot').getBoundingClientRect().top+1));
    if(width===360 || width===844 || width===1440) await page.screenshot({path:join(reports,`fix_tap-garden_${width}x${height}.png`)});
  }
  // The first supported browser language wins unless a player chose one earlier.
  for(const [languages,expected] of [[['zh-HK','en'],'zh-TW'],[['zh-Hant-TW'],'zh-TW'],[['zh-SG'],'zh-CN'],[['zh'],'zh-CN'],[['ja-JP'],'ja'],[['fr-FR','ja'],'ja'],[['de-DE'],'en']]) {
    const tab=await browser.newPage();await tab.evaluateOnNewDocument(l=>{localStorage.clear();Object.defineProperty(navigator,'languages',{get:()=>l});},languages);
    await tab.goto(BASE_URL,{waitUntil:'networkidle0'});await tab.waitForSelector('.btn--enter');check(`browser language ${languages.join(',')} maps to ${expected}`,await tab.evaluate(()=>document.documentElement.lang)===expected);await tab.close();
  }
  const saved=await browser.newPage();await saved.evaluateOnNewDocument(()=>{localStorage.setItem('tap-garden.lang','ja');Object.defineProperty(navigator,'languages',{get:()=>['zh-TW']});});await saved.goto(BASE_URL,{waitUntil:'networkidle0'});await saved.waitForSelector('.btn--enter');check('saved language overrides browser',await saved.evaluate(()=>document.documentElement.lang)==='ja');await saved.close();
  check('fix scenarios have no console errors or warnings',issues.length===0,issues.slice(0,5).join(' | '));await page.close();
}
