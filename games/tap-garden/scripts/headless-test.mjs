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
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = 4173;
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
  const server = spawn('npm', ['run', 'preview'], { cwd: root, stdio: 'ignore' });
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
      await runMain(browser);
      await runGrownGarden(browser);
      await runFallback(browser);
      await run404Probe();
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
