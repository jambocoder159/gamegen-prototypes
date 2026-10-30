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
import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { selectionChecks } from './selection-checks.mjs';
import { isDeepStrictEqual } from 'node:util';
import { catalogChecks } from './catalog-checks.mjs';
import { axeSource } from './axe-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = Number(process.env.PORT) || 4225;
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
  const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
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

    const launchBrowser = () => puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
    let browser = await launchBrowser();
    try {
      await selectionChecks(browser, BASE_URL, check);
      await runMain(browser);
      await runStages(browser);
      await runFallback(browser);
      // Release decoded art/audio before the long locale and axe matrix.
      await browser.close();
      browser = await launchBrowser();
      await catalogChecks(browser, root, PORT + 1, check, auditAxe);
      await runFixes(browser);
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
    for (const [width, height] of [[844, 390], [667, 375]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await sleep(150);
      const fits = await page.evaluate(() => {
        const panel = document.querySelector('.panel--reward');
        return panel.scrollHeight <= panel.clientHeight + 1 &&
          [...panel.querySelectorAll('button, .panel__dealer, h2, p')].every((el) => {
            const r = el.getBoundingClientRect();
            return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
          });
      });
      check(`reward art and controls fit ${width}x${height} without scrolling`, fits);
      await page.screenshot({ path: join(qa, `reward-${width}x${height}.png`) });
    }
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(150);
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

// For every stage (reached via the documented ?stage=N param), independently
// recompute from the REAL DOM bounding boxes which tiles are visually covered
// (intersection ≥ 12% of a tile) and which are side-blocked (same-layer grid
// neighbours on both sides), and confirm: (core) the game's data-free matches
// this picture exactly; (a) every free tile is enabled and bright; (b) every
// visually-covered tile is dimmed and not selectable; (c) tapping a blocked tile
// costs no heart and shows the notice; (d) a free tile can be selected.
async function readStageTiles(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('.game .board__stack button[data-tid]')];
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      const img = e.querySelector('.tile__img');
      const op = img ? parseFloat(getComputedStyle(img).opacity) : 1;
      return {
        id: Number(e.dataset.tid),
        x: Number(e.dataset.x),
        y: Number(e.dataset.y),
        z: Number(e.dataset.z),
        free: e.dataset.free === '1',
        ariaDisabled: e.getAttribute('aria-disabled') === 'true',
        opacity: op,
        tileOpacity: parseFloat(getComputedStyle(e).opacity),
        filter: img ? getComputedStyle(img).filter : 'none',
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
      };
    });
  });
}

function stageGeometryReport(tiles) {
  const interArea = (a, b) => {
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return ox > 0 && oy > 0 ? ox * oy : 0;
  };
  const coveredDom = (t) =>
    tiles.some((o) => o.id !== t.id && o.z > t.z && interArea(t, o) >= 0.12 * (t.w * t.h));
  const sideGrid = (t, dir) =>
    tiles.some((o) => o.id !== t.id && o.z === t.z && o.x === t.x + 2 * dir && Math.abs(o.y - t.y) < 2);
  const rows = tiles.map((t) => {
    const cov = coveredDom(t);
    const blockedBothSides = sideGrid(t, -1) && sideGrid(t, 1);
    return { t, cov, freeExpected: !cov && !blockedBothSides };
  });
  return rows;
}

async function runStages(browser) {
  for (let n = 1; n <= 5; n++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    try {
      await page.goto(`${BASE_URL}?stage=${n}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.btn--enter', { timeout: 20000 });
      await page.click('.btn--enter');
      await page.waitForSelector('.title__content', { timeout: 10000 });
      await page.click('.btn--play');
      await page.waitForSelector('.game .board__stack .tile', { timeout: 10000 });
      await sleep(250);

      // confirm we actually started on stage n
      const stageNum = await page.$$eval('.pill__value', (els) => (els[0]?.textContent || '').trim());
      check(`stage ${n}: ?stage=${n} opens the right stack`, stageNum.startsWith(String(n)), `HUD shows "${stageNum}"`);

      const tiles = await readStageTiles(page);
      const rows = stageGeometryReport(tiles);
      const freeCount = rows.filter((r) => r.freeExpected).length;
      const coveredCount = rows.filter((r) => r.cov).length;

      // core: the drawn picture matches the game's free flags exactly
      const mismatches = rows.filter((r) => r.freeExpected !== r.t.free);
      check(
        `stage ${n}: DOM geometry matches data-free for all ${tiles.length} tiles`,
        mismatches.length === 0,
        mismatches.length
          ? mismatches.slice(0, 4).map((r) => `#${r.t.id}(${r.t.x},${r.t.y},z${r.t.z}) exp=${r.freeExpected} got=${r.t.free}`).join(' | ')
          : `${freeCount} free, ${coveredCount} covered`,
      );

      // (a) every free tile is enabled and bright
      const freeBad = rows.filter((r) => r.freeExpected && (!r.t.free || r.t.ariaDisabled || r.t.opacity !== 1 || r.t.filter.includes('brightness(0.48)')));
      check(`stage ${n}: free tiles enabled + bright (count ${freeCount})`, freeBad.length === 0,
        freeBad.slice(0, 3).map((r) => `#${r.t.id} disabled=${r.t.ariaDisabled} op=${r.t.opacity}`).join(' | '));

      // (b) every visually-covered tile is dimmed + marked non-free
      const covBad = rows.filter((r) => r.cov && (r.t.free || r.t.opacity !== 1 || r.t.tileOpacity !== 1 || !r.t.filter.includes('brightness(0.48)')));
      check(`stage ${n}: covered tiles opaque + darker + non-free (count ${coveredCount})`, covBad.length === 0,
        covBad.slice(0, 3).map((r) => `#${r.t.id} free=${r.t.free} op=${r.t.opacity}`).join(' | '));

      // (c) tapping a blocked tile: no heart lost, a notice shows, nothing selected
      const blocked = rows.find((r) => !r.t.free);
      if (blocked) {
        const heartsBefore = await readHearts(page);
        await clickTile(page, blocked.t.id);
        await sleep(120);
        const heartsAfter = await readHearts(page);
        const noticeShown = await page.$eval('.board-notice', (el) => el.textContent.trim().length > 0).catch(() => false);
        const selected = await page.$$eval('.tile--selected', (els) => els.length);
        check(`stage ${n}: blocked tap costs no heart + shows notice`,
          heartsAfter === heartsBefore && noticeShown && selected === 0,
          `hearts ${heartsBefore}→${heartsAfter}, notice=${noticeShown}, selected=${selected}`);
      } else {
        check(`stage ${n}: blocked tap costs no heart + shows notice`, false, 'no blocked tile found');
      }

      // (d) a free tile can be selected
      const freeTile = rows.find((r) => r.freeExpected && r.t.free);
      if (freeTile) {
        await clickTile(page, freeTile.t.id);
        await sleep(100);
        const isSel = await page.$(`.tile--selected[data-tid="${freeTile.t.id}"]`);
        check(`stage ${n}: a free tile selects`, !!isSel, `tile #${freeTile.t.id}`);
        await clickTile(page, freeTile.t.id); // deselect, leave board clean
        await sleep(60);
      } else {
        check(`stage ${n}: a free tile selects`, false, 'no free tile found');
      }

      console.log(`  stage ${n} counts: ${tiles.length} tiles, ${freeCount} free, ${coveredCount} covered`);
      if (n === 2) await page.screenshot({ path: join(qa, 'stage2.png') });
      if (n === 4 || n === 5) {
        if(n===4) {
          const mm=mismatchPair(await readTiles(page));
          for(let i=0;i<2;i++){await clickTile(page,mm[0]);await clickTile(page,mm[1]);await sleep(40);}
        }
        const plan=planSolve(await readFullTiles(page));
        check(`stage ${n}: independent full UI solution exists`,!!plan);
        if(plan)for(const [a,b] of plan){await clickTile(page,a);await clickTile(page,b);await sleep(20);}
        if(n===4){
          await page.waitForSelector('.card--reward');
          check('stage 4 reward explains finale recovery',await page.$eval('.panel--reward',el=>el.textContent.includes('64')));
          await page.click('.card--reward');await sleep(100);
          check('entering finale restores at least 3 hearts and deals 64 tiles',await readHearts(page)===3 && (await readTiles(page)).length===64);
        } else {
          await page.waitForSelector('.panel--result');
          check('stage 5 can be won through real tile controls',await page.$eval('.panel__title',e=>e.textContent.includes('cleared')));
          for(const width of [375,1440]){await page.setViewport({width,height:width===375?812:900});await auditAxe(page,`victory ${width}`);}
        }
      }

    } catch (e) {
      check(`stage ${n}: per-stage geometry checks`, false, String(e).slice(0, 140));
    }
    await page.close();
  }
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

async function auditAxe(page, label) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(',')}`));
  check(`axe ${label}: zero WCAG violations`, violations.length === 0, violations.join(' | '));
}
async function gate(page) {
  await page.waitForSelector('.btn--enter', { timeout: 20000 });
  await page.click('.btn--enter');
  await page.waitForSelector('.title__content');
}
async function savedState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mahjong-deck.run'))?.state);
}
async function runFixes(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const reports = join(root,'..','_reports');
  mkdirSync(reports,{recursive:true});
  try {
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR','zh-Hant-HK'] }));
    await page.setViewport({width:375,height:812});
    await page.goto(BASE_URL,{waitUntil:'networkidle0'});
    check('browser preference selects Traditional Chinese', await page.evaluate(() => document.documentElement.lang === 'zh-TW'));
    await page.evaluate(() => localStorage.setItem('mahjong-deck.lang','en'));
    await page.reload({waitUntil:'networkidle0'});
    check('saved language overrides browser preference', await page.evaluate(() => document.documentElement.lang === 'en'));
    await gate(page);
    for (const width of [375,1440]) {
      await page.setViewport({width,height:width===375?812:900});
      await auditAxe(page,`title ${width}`);
    }
    await page.setViewport({width:375,height:812});
    await page.click('.btn--play');
    await page.waitForSelector('.coach');
    // Audit stage-1 PLAY before either starting card is consumed. WCAG 2.1 A
    // includes label-content-name-mismatch, which must cover the whole card text.
    for (const lang of ['zh-tw','zh-cn','ja','en']) {
      await page.click('.game__controls .lang .icon-btn');
      await page.waitForSelector('.lang__menu');
      await page.$$eval('.lang__menu .lang__item', (items, index) => items[index].click(), ['en','zh-tw','zh-cn','ja'].indexOf(lang));
      for (const [width,height] of [[375,812],[1440,900]]) {
        await page.setViewport({width,height});
        await page.waitForSelector('.hand [data-card="hint"]', {visible:true});
        await page.waitForSelector('.hand [data-card="shuffle"]', {visible:true});
        await auditAxe(page, `${lang} stage-1 play ${width}x${height} with starting cards`);
      }
    }
    await page.setViewport({width:375,height:812});
    check('first-run coach is visible, icon-led and non-blocking',await page.evaluate(() => {
      const coach=document.querySelector('.coach'),r=coach.getBoundingClientRect(), b=document.querySelector('.game__board').getBoundingClientRect();
      return !!coach.querySelector('img') && !!coach.querySelector('[aria-live="polite"]') && (r.bottom<=b.top || r.right<=b.left || r.left>=b.right);
    }));
    await page.screenshot({path:join(reports,'fix_mahjong-deck_onboarding.png')});
    const pair = planSolve(await readFullTiles(page))[0];
    await clickTile(page,pair[0]);
    await page.waitForFunction(() => document.querySelector('.coach p')?.textContent.includes('same picture'));
    check('coach advances after selecting a free tile',true);
    await clickTile(page,pair[1]);
    await page.waitForFunction(() => document.querySelector('.coach p')?.textContent.includes('card below'));
    check('coach advances after matching a pair',true);
    await page.keyboard.press('h');
    await page.waitForFunction(() => !document.querySelector('.coach'));
    check('coach finishes after using a card',await page.evaluate(() => localStorage.getItem('mahjong-deck.coach')==='1'));
    const mm=mismatchPair(await readTiles(page));
    await clickTile(page,mm[0]);await clickTile(page,mm[1]);
    await sleep(100);
    const before=await savedState(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload({waitUntil:'networkidle0'});await gate(page);
    check('reload offers Continue',!!await page.$('.btn--continue'));
    for(const [width,height] of [[360,640],[667,375],[844,390],[1440,900]]) {
      await page.setViewport({width,height});await sleep(80);
      const fits=await page.evaluate(()=>{
        const arts=[...document.querySelectorAll('.title__logo,.title__dealer')].map(e=>e.getBoundingClientRect());
        const texts=[...document.querySelectorAll('.title__name,.title__tagline')].map(e=>e.getBoundingClientRect());
        return arts.every(a=>texts.every(b=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom)) &&
          [...document.querySelectorAll('.title__content button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
      });
      check(`Continue title fits without art/text overlap ${width}x${height}`,fits);
      if(width===667)await page.screenshot({path:join(reports,'fix_mahjong-deck_title_landscape.png')});
    }
    await page.setViewport({width:375,height:812});
    await page.screenshot({path:join(reports,'fix_mahjong-deck_title_portrait.png')});

    await page.click('.btn--continue');await page.waitForSelector('.game .tile');
    const after=await savedState(page);
    check('mid-run reload restores tiles/hearts/cards/score/stage/seed/undo', ['tiles','hearts','hand','score','stageIndex','seed','removedOrder','shuffleCount','hint'].every(k=>isDeepStrictEqual(before[k],after[k])));
    check('completed coach stays closed after reload',!await page.$('.coach'));
    await page.click('.help-btn');await page.waitForSelector('.coach');
    await page.click('.coach__skip');
    check('help reopens coach and Skip dismisses it',!await page.$('.coach'));
    const arrangement = (await readTiles(page)).map(t=>t.type).join(',');
    await page.click('.game__controls > .icon-btn');await sleep(80);
    const next=await savedState(page);
    check('restart creates a new random seed and tile arrangement',next.seed!==before.seed && (await readTiles(page)).map(t=>t.type).join(',')!==arrangement);
    check('restart resets hearts, cards, score and stage',next.hearts===3 && next.score===0 && next.stageIndex===0 && next.hand.length===2);
    // Every locale at the narrowest width with a full four-type hand, including Heal.
    for (const lang of ['en','zh-tw','zh-cn','ja']) {
      const state=await savedState(page);
      state.hand=[{type:'heal',count:1},{type:'wild',count:1},{type:'undo',count:1},{type:'combo',count:1}];state.hearts=2;
      await page.goto(BASE_URL,{waitUntil:'networkidle0'});
      await page.waitForSelector('.btn--enter');
      await page.evaluate(({lang,state})=>{localStorage.setItem('mahjong-deck.lang',lang);localStorage.setItem('mahjong-deck.run',JSON.stringify({version:1,state}));},{lang,state});
      await page.reload({waitUntil:'networkidle0'});await gate(page);await page.click('.btn--continue');await page.waitForSelector('.hand [data-card="heal"]');
      await page.setViewport({width:360,height:640});await sleep(100);
      const metrics=await page.evaluate(()=>({
        fonts:[...document.querySelectorAll('.pill__label,.pill__value')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=18),
        numbers:[...document.querySelectorAll('.pill__value')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=20),
        hearts:[...document.querySelectorAll('.hearts__icon')].every(e=>e.getBoundingClientRect().width>=28),
        buttons:[...document.querySelectorAll('.game__controls button')].every(e=>e.getBoundingClientRect().width>=48 && e.getBoundingClientRect().height>=48),
        text:[...document.querySelectorAll('.pill__label,.pill__value,.card__effect,.card__name')].every(e=>e.scrollWidth<=e.clientWidth+1),
        heal:(()=>{const b=document.querySelector('[data-card="heal"]');return b.title.includes('5') && (b.getAttribute('aria-label') ?? b.textContent).includes('5') && b.textContent.includes('5');})()
      }));
      check(`${lang}: HUD sizing, full hand fits 360x640, Heal explained in text/tooltip/aria`,Object.values(metrics).every(Boolean),JSON.stringify(metrics));
      const a=await auditLayout(page);check(`${lang}: full hand stays on screen without overlaps`,!a.clipped&&!a.overlap);
      for(const [width,height] of [[667,375],[844,390],[466,678],[1440,900]]){
        await page.setViewport({width,height});await sleep(80);
        const a=await auditLayout(page);check(`${lang}: full hand fits ${width}x${height}`,!a.clipped&&!a.overlap);
      }
      for(const [width,height] of [[375,812],[1440,900]]){
        await page.setViewport({width,height});
        await page.waitForSelector('.hand [data-card="heal"]', {visible:true});
        await auditAxe(page, `${lang} stage-1 play ${width}x${height} with full hand`);
      }
      await page.setViewport({width:360,height:640});
      await page.click('[data-card="heal"]');await sleep(60);
      check(`${lang}: Heal restores one heart and consumes the card`,await readHearts(page)===3&&!await page.$('.hand [data-card="heal"]'));
    }
    {
      const state=await savedState(page);state.hearts=5;state.hand=[{type:'heal',count:1}];
      await page.goto(BASE_URL,{waitUntil:'networkidle0'});await page.waitForSelector('.btn--enter');
      await page.evaluate(state=>localStorage.setItem('mahjong-deck.run',JSON.stringify({version:1,state})),state);
      await page.reload({waitUntil:'networkidle0'});await gate(page);await page.click('.btn--continue');await page.waitForSelector('.hand [data-card="heal"]');
      await page.click('.hand [data-card="heal"]');await sleep(60);
      check('Heal is kept at the five-heart cap',await readHearts(page)===5 && !!await page.$('.hand [data-card="heal"]'));
    }
    for(const [width,height,name] of [[375,812,'portrait'],[1440,900,'desktop'],[667,375,'landscape']]){
      await page.setViewport({width,height});await sleep(100);
      await page.screenshot({path:join(reports,`fix_mahjong-deck_${name}.png`)});
      if(width!==667)await auditAxe(page,`play ${width}`);
    }
    // A real board clear reaches the card picker. Heal text is asserted in all
    // languages by a validated reward save, with unchanged legitimate tiles.
    await page.setViewport({width:375,height:812});
    const plan=planSolve(await readFullTiles(page));
    for(const [a,b] of plan){await clickTile(page,a);await clickTile(page,b);await sleep(20);}
    await page.waitForSelector('.panel--reward');
    for(const width of [375,1440]){await page.setViewport({width,height:width===375?812:900});await auditAxe(page,`reward ${width}`);}
    for(const lang of ['en','zh-tw','zh-cn','ja']){
      const state=await savedState(page);state.rewards=['heal','shuffle','wild'];
      await page.goto(BASE_URL,{waitUntil:'networkidle0'});
      await page.waitForSelector('.btn--enter');
      await page.evaluate(({lang,state})=>{localStorage.setItem('mahjong-deck.lang',lang);localStorage.setItem('mahjong-deck.run',JSON.stringify({version:1,state}));},{lang,state});
      await page.reload({waitUntil:'networkidle0'});await gate(page);await page.click('.btn--continue');await page.waitForSelector('.card--reward[data-card="heal"]');
      check(`${lang}: picker explains Heal cap and restoration`,await page.$eval('.card--reward[data-card="heal"]',b=>b.textContent.includes('5')&&(b.getAttribute('aria-label') ?? b.textContent).includes('5')));
      for(const [width,height] of [[375,812],[1440,900]]){
        await page.setViewport({width,height});
        await auditAxe(page, `${lang} reward ${width}x${height}`);
      }
    }
    await page.click('.card--reward[data-card="heal"]');
    // Force ordinary mismatches through the public tile UI until defeat.
    for(let i=0;i<5&&!await page.$('.panel--result');i++){
      const pair=mismatchPair(await readTiles(page));if(!pair)break;
      await clickTile(page,pair[0]);await clickTile(page,pair[1]);await sleep(60);
    }
    check('game over clears saved run',!!await page.$('.panel--result') && await page.evaluate(()=>localStorage.getItem('mahjong-deck.run')===null));
    for(const width of [375,1440]){await page.setViewport({width,height:width===375?812:900});await auditAxe(page,`defeat ${width}`);}
    // Invalid / oversized / unknown-version state must never offer Continue.
    for(const raw of ['{bad',JSON.stringify({version:99,state:{}}),'x'.repeat(50000)]){
      await page.evaluate(raw=>localStorage.setItem('mahjong-deck.run',raw),raw);
      await page.reload({waitUntil:'networkidle0'});await gate(page);
      check('corrupt save safely resets',!await page.$('.btn--continue'));
    }
  } finally {await context.close();}
  for(const name of ['wide','near-square','stage2'])copyFileSync(join(qa,`${name}.png`),join(reports,`fix_mahjong-deck_${name}.png`));
}
