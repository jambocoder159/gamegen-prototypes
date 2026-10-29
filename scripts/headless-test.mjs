// Headless QA for Shelf Sort. Builds, serves with `vite preview`, and drives the
// real game through its public pointer/keyboard UI (clicking slot buttons and
// reading their aria-labels — no private hooks). Checks: zero console
// errors/warnings and zero failed requests, the loading gate + enter, a running
// title demo, a full level-1 solve to the win overlay with a star rating, all
// four languages with no text overflow, resize mid-game without reload/state
// loss, no clipping/overlap of slots+pills+buttons across the viewport matrix
// (incl. a 9-shelf level at 360×640), and a blocked-image fallback. Screenshots
// go to qa/. Prints PASS/FAIL.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = 4174;
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

// --- greedy solver mirrored from src/game/solver.ts, over aria-label contents --
function findItem(cells, t, excludeShelf) {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === t && Math.floor(i / 3) !== excludeShelf) return i;
  }
  return -1;
}
function chooseMove(cells) {
  const S = cells.length / 3;
  const shelf = (s) => [cells[s * 3], cells[s * 3 + 1], cells[s * 3 + 2]];
  const empties = (s) => [s * 3, s * 3 + 1, s * 3 + 2].filter((i) => cells[i] === null);
  // 1) completion: two of a kind + one empty
  for (let s = 0; s < S; s++) {
    const items = shelf(s).filter((x) => x !== null);
    const e = empties(s);
    if (items.length === 2 && items[0] === items[1] && e.length === 1) {
      const src = findItem(cells, items[0], s);
      if (src >= 0) return [src, e[0]];
    }
  }
  // 2) extend a pure single into a pair
  for (let s = 0; s < S; s++) {
    const items = shelf(s).filter((x) => x !== null);
    const e = empties(s);
    if (items.length === 1 && e.length >= 1) {
      const src = findItem(cells, items[0], s);
      if (src >= 0) return [src, e[0]];
    }
  }
  // 3) start a build: most-concentrated type into a fully empty shelf
  let emptyShelf = -1;
  for (let s = 0; s < S; s++) if (shelf(s).every((c) => c === null)) { emptyShelf = s; break; }
  if (emptyShelf < 0) return null;
  const counts = new Map();
  for (let s = 0; s < S; s++) {
    const items = shelf(s).filter((x) => x !== null);
    const local = new Map();
    for (const t of items) local.set(t, (local.get(t) || 0) + 1);
    for (const [t, c] of local) {
      const cur = counts.get(t);
      if (!cur || c > cur.c) {
        const src = [s * 3, s * 3 + 1, s * 3 + 2].find((i) => cells[i] === t);
        counts.set(t, { c, src });
      }
    }
  }
  let pick = null;
  for (const [, v] of counts) if (!pick || v.c > pick.c) pick = v;
  if (!pick) return null;
  return [pick.src, emptyShelf * 3];
}

async function readCells(page) {
  const rows = await page.$$eval('.game [data-slot]', (els) =>
    els.map((e) => ({ i: Number(e.dataset.slot), label: e.getAttribute('aria-label') || '' })),
  );
  const cells = [];
  for (const { i, label } of rows) {
    const after = label.split(': ')[1] || '';
    const content = after.split(',')[0].trim();
    cells[i] = content.toLowerCase() === 'empty' ? null : content;
  }
  return cells;
}

async function playToWin(page, cap = 300) {
  for (let n = 0; n < cap; n++) {
    if (await page.$('.panel--win')) return true;
    const cells = await readCells(page);
    const mv = chooseMove(cells);
    if (!mv) return false;
    await page.click(`.game [data-slot="${mv[0]}"]`);
    await sleep(25);
    await page.click(`.game [data-slot="${mv[1]}"]`);
    await sleep(55);
  }
  return !!(await page.$('.panel--win'));
}

// pairwise-overlap + inside-viewport audit of slots, pills and control buttons
async function auditLayout(page) {
  return page.evaluate(() => {
    const sel = '.slot, .pill, .game__controls .btn, .game__controls .icon-btn';
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
      await runManyShelves(browser);
      await runFallback(browser);
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

  // title demo running (board changes over time)
  await page.waitForSelector('.title__content', { timeout: 10000 });
  await page.waitForSelector('.title__demo .slot', { timeout: 10000 });
  const snap1 = await page.$eval('.title__demo .board__grid', (el) => el.innerHTML);
  await sleep(1600);
  const snap2 = await page.$eval('.title__demo .board__grid', (el) => el.innerHTML);
  check('title demo is running (board changes over time)', snap1 !== snap2);
  await page.screenshot({ path: join(qa, 'title.png') });

  // start a real game at level 1
  await page.click('.btn--play');
  await page.waitForSelector('.game .board__grid .slot', { timeout: 10000 });
  await page.evaluate(() => {
    window.__ALIVE__ = 'yes';
  });
  await sleep(200);
  await page.screenshot({ path: join(qa, 'gameplay.png') });

  // solve level 1 to the win overlay
  const won = await playToWin(page);
  check('level 1 solved to win overlay', won);
  if (won) {
    const stars = await page.$$eval('.panel--win .stars--lg .stars__star', (els) => ({
      total: els.length,
      on: els.filter((e) => !e.className.includes('stars__star--off')).length,
    }));
    check('win overlay shows a 3-star rating', stars.total === 3 && stars.on >= 1, `on=${stars.on}`);
    const hasScore = (await page.$('.panel__stars')) !== null && (await page.$('.panel__score')) !== null;
    check('win overlay shows stars + score text', hasScore);
    await page.screenshot({ path: join(qa, 'result.png') });
    // back to a live game for language/resize checks
    await page.click('.panel--win .btn');
    await page.waitForSelector('.game .board__grid .slot', { timeout: 10000 });
  }

  // make a couple of moves so there is non-trivial state to preserve
  {
    const cells = await readCells(page);
    const mv = chooseMove(cells);
    if (mv) {
      await page.click(`.game [data-slot="${mv[0]}"]`);
      await sleep(30);
      await page.click(`.game [data-slot="${mv[1]}"]`);
      await sleep(60);
    }
  }

  // languages: cycle all four, check <html lang> and no text overflow
  const expectLang = { en: 'en', 'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN', ja: 'ja' };
  let langOk = true;
  let overflowOk = true;
  for (const item of ['en', 'zh-tw', 'zh-cn', 'ja']) {
    await page.click('.game__controls .lang .icon-btn');
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
        '.btn, .pill__value, .pill__label, .panel__title, .lang__item, .title__name, .title__tagline, .loading__pct, .levelcell__n',
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
  await page.click('.game__controls .lang .icon-btn');
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
  const sig = (cells) => cells.map((c) => (c === null ? '.' : c)).join(',');
  const before = sig(await readCells(page));
  let resizeAlive = true;
  let stateOk = true;
  let onScreen = true;
  let noOverlap = true;
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: w === 390 ? 3 : 1 });
    await sleep(150);
    if ((await page.evaluate(() => window.__ALIVE__)) !== 'yes') resizeAlive = false;
    if (sig(await readCells(page)) !== before) stateOk = false;
    const a = await auditLayout(page);
    if (a.clipped) onScreen = false;
    if (a.overlap) {
      noOverlap = false;
      check(`no overlap at ${w}x${h}`, false);
    }
  }
  check('no reload across resizes (window var survived)', resizeAlive);
  check('game state survived resizes (board unchanged)', stateOk);
  check('slots/pills/buttons stay within viewport across sizes', onScreen);
  check('no pairwise overlap of slots/pills/buttons across sizes', noOverlap);

  // layout screenshots
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await sleep(160);
  await page.screenshot({ path: join(qa, 'wide.png') });
  await page.setViewport({ width: 626, height: 890, deviceScaleFactor: 1 });
  await sleep(160);
  await page.screenshot({ path: join(qa, 'near-square.png') });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await sleep(160);
  await page.screenshot({ path: join(qa, 'portrait.png') });

  check('no console errors/warnings', consoleIssues.length === 0, consoleIssues.slice(0, 4).join(' | '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 4).join(' | '));
  await page.close();
}

// A high level (9 shelves) at 360×640 must fit with no clipping/overlap.
async function runManyShelves(browser) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem(
        'shelf-sort.progress',
        JSON.stringify({ unlocked: 12, stars: new Array(12).fill(3) }),
      );
    } catch {
      /* ignore */
    }
  });
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.btn--enter', { timeout: 20000 });
  await page.click('.btn--enter');
  await page.waitForSelector('.btn--play', { timeout: 10000 });
  await page.click('.btn--play');
  await page.waitForSelector('.game .board__grid .slot', { timeout: 10000 });
  // open level picker and choose level 11 (9 shelves)
  await page.click('.game__controls .btn--levels');
  await page.waitForSelector('.levelgrid', { timeout: 5000 });
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.levelcell')];
    if (cells[10]) cells[10].click();
  });
  await page.waitForSelector('.game .board__grid .slot', { timeout: 10000 });
  await sleep(250);
  const shelves = await page.$$eval('.board__grid > div', (els) => els.length);
  check('level 11 has 9 shelves', shelves === 9, `got ${shelves}`);
  const a = await auditLayout(page);
  check('9-shelf level at 360x640: nothing clipped', !a.clipped);
  check('9-shelf level at 360x640: no overlap', !a.overlap, `${a.count} elements`);
  await page.screenshot({ path: join(qa, 'many-shelves.png') });
  await page.close();
}

async function runFallback(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  let blocked = 0;
  page.on('request', (req) => {
    if (req.url().includes('icon_goods_milk.png')) {
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
