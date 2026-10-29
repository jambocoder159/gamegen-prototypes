// Headless QA for Mahjong Deck. Builds, serves with `vite preview`, and drives the
// real game through its public pointer/keyboard UI (clicking tile buttons and
// reading their data attributes / aria-labels — no private hooks). Checks: zero
// console errors/warnings and zero failed requests, the loading gate + enter, a
// running title demo, a mismatch costing a heart, the hint card highlighting a
// pair, score increasing on a match, stage 1 cleared to the reward screen,
// choosing a reward card that then appears in the hand, all four languages with no
// text overflow, resize mid-game without reload/state loss, no clipping/overlap of
// the HUD/hand/control chrome across the viewport matrix, and a blocked-image
// fallback. Also runs the node logic test. Screenshots go to qa/. Prints PASS/FAIL.

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

// --- read the live board from the real DOM --------------------------------
async function readTiles(page) {
  return page.$$eval('.game [data-tid]', (els) =>
    els.map((e) => ({
      id: Number(e.dataset.tid),
      type: e.dataset.type,
      free: e.dataset.free === '1',
    })),
  );
}
async function readFullTiles(page) {
  return page.$$eval('.game [data-tid]', (els) =>
    els.map((e) => ({
      id: Number(e.dataset.tid),
      x: Number(e.dataset.x),
      y: Number(e.dataset.y),
      z: Number(e.dataset.z),
      type: e.dataset.type,
    })),
  );
}

// Compute a full winning pair order with DFS (mirror of the game's free rule),
// so the bot never strands the board and triggers a reshuffle.
function planSolve(full) {
  const tiles = full.map((t) => ({ ...t, removed: false }));
  const overlap = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
  const isFree = (t) => {
    if (t.removed) return false;
    for (const o of tiles) if (!o.removed && o.z > t.z && overlap(t, o)) return false;
    let left = false, right = false;
    for (const o of tiles) {
      if (o.removed || o.z !== t.z) continue;
      if (o.x === t.x - 2 && Math.abs(o.y - t.y) < 2) left = true;
      if (o.x === t.x + 2 && Math.abs(o.y - t.y) < 2) right = true;
    }
    return !left || !right;
  };
  const failed = new Set();
  const plan = [];
  let nodes = 0;
  const key = () => tiles.filter((t) => !t.removed).map((t) => t.id).join(',');
  function dfs() {
    if (tiles.every((t) => t.removed)) return true;
    if (++nodes > 2_000_000) return false;
    const k = key();
    if (failed.has(k)) return false;
    const free = tiles.filter((t) => isFree(t));
    const byType = new Map();
    for (const t of free) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(t);
    }
    for (const [, g] of byType) {
      for (let i = 0; i < g.length; i++)
        for (let j = i + 1; j < g.length; j++) {
          g[i].removed = true;
          g[j].removed = true;
          plan.push([g[i].id, g[j].id]);
          if (dfs()) return true;
          plan.pop();
          g[i].removed = false;
          g[j].removed = false;
        }
    }
    failed.add(k);
    return false;
  }
  return dfs() ? plan : null;
}
function mismatchPair(tiles) {
  const free = tiles.filter((t) => t.free);
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++)
      if (free[i].type !== free[j].type) return [free[i].id, free[j].id];
  return null;
}
async function clickTile(page, id) {
  await page.$eval(`.game [data-tid="${id}"]`, (el) => el.click());
}
async function readScore(page) {
  return page.$$eval('.pill__value', (els) => {
    const txt = els[1]?.textContent || '0';
    return Number(txt.replace(/[^0-9]/g, '')) || 0;
  });
}
async function readHearts(page) {
  return page.$$eval('.hearts__icon', (els) =>
    els.filter((e) => !e.className.includes('hearts__icon--off')).length,
  );
}

// pairwise-overlap + inside-viewport audit of the HUD/hand/control chrome (the
// tile stack is intentionally overlapping, so tiles are excluded).
async function auditLayout(page) {
  return page.evaluate(() => {
    const sel =
      '.pill, .hearts, .hand .card, .game__controls .btn, .game__controls .icon-btn, .combo-pill, .wild-flag';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rects = [...document.querySelectorAll(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    // the board must also stay on-screen
    const board = document.querySelector('.game__board');
    if (board) rects.push(board.getBoundingClientRect());
    let clipped = false;
    for (const r of rects) {
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) clipped = true;
    }
    // overlap audit excludes the board rect (last) — tiles live inside it
    const chrome = rects.slice(0, board ? -1 : undefined);
    let overlap = false;
    for (let i = 0; i < chrome.length && !overlap; i++) {
      for (let j = i + 1; j < chrome.length; j++) {
        const a = chrome[i];
        const b = chrome[j];
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
  console.log('Running logic test…');
  try {
    execSync('node scripts/test-logic.mjs', { cwd: root, stdio: 'inherit' });
    check('node logic test (layouts + generation)', true);
  } catch {
    check('node logic test (layouts + generation)', false);
  }

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
  await page.waitForSelector('.title__demo .tile', { timeout: 10000 });
  const snap1 = await page.$eval('.title__demo .board__stack', (el) => el.innerHTML);
  await sleep(1800);
  const snap2 = await page.$eval('.title__demo .board__stack', (el) => el.innerHTML);
  check('title demo is running (board changes over time)', snap1 !== snap2);
  await page.screenshot({ path: join(qa, 'title.png') });

  // start a real game at stage 1
  await page.click('.btn--play');
  await page.waitForSelector('.game .board__stack .tile', { timeout: 10000 });
  await page.evaluate(() => {
    window.__ALIVE__ = 'yes';
  });
  await sleep(200);
  await page.screenshot({ path: join(qa, 'gameplay.png') });

  // --- mismatch costs a heart ---
  {
    const heartsBefore = await readHearts(page);
    const tiles = await readTiles(page);
    const mm = mismatchPair(tiles);
    if (mm) {
      await clickTile(page, mm[0]);
      await sleep(30);
      await clickTile(page, mm[1]);
      await sleep(120);
      const heartsAfter = await readHearts(page);
      check('mismatch costs a heart', heartsAfter === heartsBefore - 1, `${heartsBefore}→${heartsAfter}`);
    } else {
      check('mismatch costs a heart', false, 'no differing free pair found');
    }
  }

  // --- hint card highlights a pair ---
  {
    await page.keyboard.press('h');
    await sleep(120);
    const hinted = await page.$$eval('.tile--hint, .tile--hint-static', (els) => els.length);
    check('hint card highlights a pair', hinted >= 2, `${hinted} tiles highlighted`);
  }

  // --- score increases on a match, then clear stage 1 following a full plan ---
  const plan = planSolve(await readFullTiles(page));
  check('bot computed a full solve plan for stage 1', !!plan);
  let reward = false;
  if (plan) {
    const scoreBefore = await readScore(page);
    // first planned match → score should rise
    await clickTile(page, plan[0][0]);
    await sleep(30);
    await clickTile(page, plan[0][1]);
    await sleep(110);
    const scoreAfter = await readScore(page);
    check('score increases on a match', scoreAfter > scoreBefore, `${scoreBefore}→${scoreAfter}`);
    // execute the rest of the plan
    for (let i = 1; i < plan.length; i++) {
      if (await page.$('.panel--reward')) break;
      await clickTile(page, plan[i][0]);
      await sleep(16);
      await clickTile(page, plan[i][1]);
      await sleep(36);
    }
    await sleep(120);
    reward = !!(await page.$('.panel--reward'));
  }
  check('stage 1 cleared to the reward screen', reward);
  if (reward) {
    const choices = await page.$$eval('.card--reward', (els) => els.length);
    check('reward screen offers three cards', choices === 3, `${choices} cards`);
    await page.screenshot({ path: join(qa, 'result.png') });
    // pick the first reward and confirm it appears in the hand on the next stage
    const picked = await page.$eval('.card--reward', (el) => el.getAttribute('data-card'));
    await page.click('.card--reward');
    await page.waitForSelector('.game .board__stack .tile', { timeout: 10000 });
    await sleep(150);
    const handHas = await page.$$eval('.hand .card', (els) =>
      els.map((e) => e.getAttribute('data-card')),
    );
    check('chosen reward card appears in the hand', handHas.includes(picked), `picked ${picked} · hand ${handHas.join(',')}`);
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
    await sleep(150);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    if (htmlLang !== expectLang[item]) {
      langOk = false;
      check(`html lang for ${item}`, false, `got ${htmlLang}`);
    }
    const overflow = await page.evaluate(() => {
      const bad = [];
      const els = document.querySelectorAll(
        '.btn, .pill__value, .pill__label, .panel__title, .lang__item, .title__name, .title__tagline, .loading__pct, .card__name, .card__effect, .combo-pill',
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
  const sig = (tiles) => tiles.map((t) => `${t.id}:${t.type}`).sort().join(',');
  const before = sig(await readTiles(page));
  let resizeAlive = true;
  let stateOk = true;
  let onScreen = true;
  let noOverlap = true;
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: w === 390 ? 3 : 1 });
    await sleep(160);
    if ((await page.evaluate(() => window.__ALIVE__)) !== 'yes') resizeAlive = false;
    if (sig(await readTiles(page)) !== before) stateOk = false;
    const a = await auditLayout(page);
    if (a.clipped) {
      onScreen = false;
      check(`nothing clipped at ${w}x${h}`, false);
    }
    if (a.overlap) {
      noOverlap = false;
      check(`no chrome overlap at ${w}x${h}`, false);
    }
  }
  check('no reload across resizes (window var survived)', resizeAlive);
  check('game state survived resizes (board unchanged)', stateOk);
  check('HUD/hand/controls stay within viewport across sizes', onScreen);
  check('no pairwise overlap of HUD/hand/controls across sizes', noOverlap);

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

async function runFallback(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  let blocked = 0;
  page.on('request', (req) => {
    if (req.url().includes('icon_tile_bamboo.png')) {
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
