// Headless QA for Mochi Merge. Builds, serves with `vite preview`, drives the
// real game through its public keyboard/pointer API (no private hooks), and
// checks: zero console errors/warnings and zero failed requests, the loading
// gate + enter, a running title demo, real gameplay to a result screen, all four
// languages with no text overflow, resize mid-game without reload/state loss,
// and a blocked-image fallback. Screenshots go to qa/. Prints PASS/FAIL.

import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = Number(process.env.PORT) || 4173;
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

async function main() {
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

  // loading gate → enter
  await page.waitForSelector('.btn--enter', { timeout: 20000 });
  check('loading screen reached enter button', true);
  await page.screenshot({ path: join(qa, 'loading.png') });

  await page.click('.btn--enter');

  // title demo running
  await page.waitForSelector('.title__content', { timeout: 10000 });
  await page.waitForSelector('.board__tiles .tile', { timeout: 10000 });
  const snap1 = await page.$eval('.board__tiles', (el) => el.innerHTML);
  await sleep(1400);
  const snap2 = await page.$eval('.board__tiles', (el) => el.innerHTML);
  check('title demo is running (board changes over time)', snap1 !== snap2);
  await page.screenshot({ path: join(qa, 'title.png') });

  // start a real game
  await page.click('.btn--play');
  await page.waitForSelector('.game .board', { timeout: 10000 });
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
  if (gotResult) await page.screenshot({ path: join(qa, 'result.png') });

  // restart to get back to a live game for the language/resize checks
  if (gotResult) {
    await page.click('.panel--result .btn--primary');
    await page.waitForSelector('.game .board', { timeout: 10000 });
  }

  // languages: cycle all four, check <html lang> and no text overflow
  const expectLang = { en: 'en', 'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN', ja: 'ja' };
  let langOk = true;
  let overflowOk = true;
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
        '.btn, .pill__value, .pill__label, .panel__title, .lang__item, .title__name, .title__tagline, .loading__pct',
      );
      for (const el of els) {
        if (el.scrollWidth > el.clientWidth + 1)
          bad.push((el.className || el.tagName) + ':' + el.textContent);
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
    [1280, 720],
    [1920, 1080],
    [466, 678],
    [678, 466],
    [626, 890],
    [890, 626],
    [445, 626],
  ];
  const scoreMid = await readScore().catch(() => 0);
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
      const targets = document.querySelectorAll('.game__board .board, .game__controls .icon-btn');
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) return true;
      }
      return false;
    });
    if (clipped) onScreen = false;
  }
  check('no reload across resizes (window var survived)', resizeAlive);
  check('game state survived resizes (score kept)', (await readScore().catch(() => -1)) === scoreMid);
  check('board + controls stay within viewport across sizes', onScreen);

  // layout screenshots
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await sleep(150);
  await page.screenshot({ path: join(qa, 'wide.png') });
  await page.setViewport({ width: 626, height: 890, deviceScaleFactor: 1 });
  await sleep(150);
  await page.screenshot({ path: join(qa, 'near-square.png') });

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
    await page.waitForSelector('.btn--enter', { timeout: 20000 });
    await page.click('.btn--enter');
    const titleShown = (await page.waitForSelector('.title__content', { timeout: 10000 })) !== null;
    check('game still starts with a blocked image (fallback)', titleShown && blockedOne);
  } catch (e) {
    check('game still starts with a blocked image (fallback)', false, String(e).slice(0, 120));
  }
  await page.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
