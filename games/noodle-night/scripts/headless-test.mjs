// Headless QA: build, serve with vite preview, drive the real game through its
// public keyboard/pointer API and assert the platform rules. Writes screenshots to
// qa/ and prints a PASS/FAIL list. Exits non-zero on any failure.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
mkdirSync(qa, { recursive: true });

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const PROBE = '/__deliberate_404_probe__';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForServer(url, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.destroy();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeout) reject(new Error('server timeout'));
          else setTimeout(tick, 250);
        });
    };
    tick();
  });
}

console.log('Building…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('Starting vite preview…');
const server = spawn(
  process.execPath,
  [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);

let browser;
let exitCode = 0;
try {
  await waitForServer(BASE);

  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

  const consoleIssues = [];
  const failedReq = [];
  page.on('console', (m) => {
    const type = m.type();
    if (type === 'error' || type === 'warning') consoleIssues.push(`${type}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleIssues.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (!r.url().includes(PROBE)) failedReq.push(`${r.url()} ${r.failure()?.errorText || ''}`);
  });

  // sub-path-safe: base './' means the app loads from any path; serve from root.
  await page.goto(BASE, { waitUntil: 'networkidle2' });

  // deliberate 404 probe — must be tolerated by the harness
  await page.evaluate((p) => fetch(p).catch(() => {}), PROBE);

  // ---- loading gate ----
  await page.waitForSelector('.enter-btn', { timeout: 15000 });
  check('loading screen reaches enter button', true);

  await page.click('.enter-btn');
  await page.waitForSelector('.title-screen', { timeout: 8000 });
  await wait(300);
  await page.screenshot({ path: join(qa, 'title.png') });

  // ---- title demo is running (DOM changes over time) ----
  const sig1 = await page.evaluate(() => document.querySelector('.demo-field')?.innerHTML.length || 0);
  await wait(1800);
  const sig2 = await page.evaluate(() => document.querySelector('.demo-field')?.innerHTML.length || 0);
  const changed = await page.evaluate(() => {
    const a = document.querySelector('.demo-field')?.innerHTML || '';
    window.__demoSnap = a;
    return true;
  });
  await wait(900);
  const demoMoved = await page.evaluate(() => {
    const b = document.querySelector('.demo-field')?.innerHTML || '';
    return b !== window.__demoSnap;
  });
  check('title demo is running', (changed && demoMoved) || sig1 !== sig2);

  // ---- start a real game ----
  await page.click('.play-btn');
  await page.waitForSelector('.game-screen', { timeout: 8000 });
  await page.evaluate(() => {
    window.__noReload = 'kept-' + Date.now();
  });
  await wait(400);

  const readCoins = () =>
    page.evaluate(() => Number(document.querySelector('.hud-coins-num')?.textContent || '0'));

  async function serveSelected() {
    const keys = await page.evaluate(() => {
      const map = {
        icon_egg: 1,
        icon_scallion: 2,
        icon_pork: 3,
        icon_fishcake: 4,
        icon_chili: 5,
        icon_bokchoy: 6,
      };
      const sel =
        document.querySelector('.customer.selected .bubble-content') ||
        document.querySelector('.customer .bubble-content');
      if (!sel) return null;
      const out = [];
      for (const img of sel.querySelectorAll('img')) {
        const src = img.getAttribute('src') || '';
        for (const k in map) if (src.includes(k)) out.push(map[k]);
      }
      return out;
    });
    if (!keys || !keys.length) return false;
    await page.keyboard.press('c');
    for (const k of keys) await page.keyboard.press(String(k));
    await page.keyboard.press('Enter');
    await wait(120);
    return true;
  }

  const coinsBefore = await readCoins();
  let correct = 0;
  for (let i = 0; i < 8 && correct < 5; i++) {
    if (await serveSelected()) correct++;
    await wait(180);
  }
  const coinsAfter = await readCoins();
  check('score increases on correct serves', coinsAfter > coinsBefore, `${coinsBefore} -> ${coinsAfter}`);
  await page.screenshot({ path: join(qa, 'gameplay.png') });
  await page.screenshot({ path: join(qa, 'portrait.png') });

  // ---- language sweep: <html lang> + no text overflow ----
  const overflowSel =
    '.plate-label, .topping-label, .hud-coins-num, .hud-combo-num, .game-title, .panel h2, .panel p';
  const langsSeen = new Set();
  let overflowBad = [];
  for (let i = 0; i < 4; i++) {
    await page.click('.lang-btn');
    await wait(250);
    const lang = await page.evaluate(() => document.documentElement.lang);
    langsSeen.add(lang);
    const bad = await page.evaluate((sel) => {
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.className}:"${el.textContent?.slice(0, 20)}"`);
      }
      return out;
    }, overflowSel);
    overflowBad = overflowBad.concat(bad);
  }
  check('all 4 <html lang> values applied', langsSeen.size >= 4, [...langsSeen].join(','));
  check('no text overflow across languages', overflowBad.length === 0, overflowBad.slice(0, 4).join(' | '));

  // ---- resize sweep mid-game: no reload, state survives, nothing clipped ----
  const sizes = [
    [375, 812, 1],
    [360, 640, 1],
    [390, 844, 3],
    [844, 390, 1],
    [1280, 720, 1],
    [1920, 1080, 1],
    [466, 678, 1],
    [678, 466, 1],
    [626, 890, 1],
    [890, 626, 1],
    [445, 626, 1],
  ];
  const coinsAtResize = await readCoins();
  let reloadLost = false;
  let stateLost = false;
  let clipped = [];
  for (const [w, h, dpr] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
    await wait(160);
    const kept = await page.evaluate(() => typeof window.__noReload === 'string');
    if (!kept) reloadLost = true;
    const coinsNow = await readCoins();
    if (coinsNow !== coinsAtResize) stateLost = true;
    const outOfBounds = await page.evaluate(
      (vw, vh) => {
        const probe = ['.hud', '.utility-bar', '.serve-btn', '.toppings', '.bowl'];
        const bad = [];
        for (const s of probe) {
          const el = document.querySelector(s);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.right < 2 || r.bottom < 2 || r.left > vw - 2 || r.top > vh - 2) bad.push(s);
          else if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2) bad.push(s + '(partial)');
        }
        return bad;
      },
      w,
      h,
    );
    if (outOfBounds.length) clipped.push(`${w}x${h}:${outOfBounds.join(',')}`);
    if (w === 1280 && h === 720) await page.screenshot({ path: join(qa, 'wide.png') });
    if (w === 626 && h === 890) await page.screenshot({ path: join(qa, 'square.png') });
    if (w === 890 && h === 626) await page.screenshot({ path: join(qa, 'nearsquare.png') });
  }
  check('no reload during resize (window var survived)', !reloadLost);
  check('game state survives resize', !stateLost, `coins stayed ${coinsAtResize}`);
  check('nothing important clipped on resize', clipped.length === 0, clipped.slice(0, 4).join(' | '));

  // ---- reach game over / result screen ----
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  // move focus off any button so the global Enter->serve handler fires
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('c'); // empty bowl -> wrong serve -> lose a heart
    await page.keyboard.press('Enter');
    await wait(180);
    const over = await page.$('.result-panel');
    if (over) break;
  }
  const resultShown = await page.$('.result-panel');
  check('game over / result screen reachable', !!resultShown);
  if (resultShown) {
    await wait(200);
    await page.screenshot({ path: join(qa, 'result.png') });
  }

  // A 404 "failed to load resource" line is only expected from the deliberate probe.
  const is404 = (s) => s.includes('Failed to load resource') && s.includes('404');
  const console404 = consoleIssues.filter(is404);
  const consoleOther = consoleIssues.filter((s) => !is404(s));
  check('no console errors/warnings (excluding deliberate 404 probe)', consoleOther.length === 0, consoleOther.slice(0, 4).join(' | '));
  check('only the deliberate 404 probe 404s', console404.length <= 1, `${console404.length} 404 console lines`);
  check('no unexpected failed requests', failedReq.length === 0, failedReq.slice(0, 4).join(' | '));

  // ---- fallback: block one image, game still starts ----
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page2.setRequestInterception(true);
  page2.on('request', (r) => {
    if (r.url().includes('icon_egg.png')) r.abort();
    else r.continue();
  });
  await page2.goto(BASE, { waitUntil: 'networkidle2' });
  let fallbackOk = false;
  try {
    await page2.waitForSelector('.enter-btn', { timeout: 15000 });
    await page2.click('.enter-btn');
    await page2.waitForSelector('.title-screen', { timeout: 8000 });
    fallbackOk = true;
  } catch {
    fallbackOk = false;
  }
  check('game still starts with a blocked image', fallbackOk);
  await page2.close();
} catch (err) {
  console.error('ERROR:', err);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length || exitCode) {
  console.log('FAILED:', failed.map((f) => f.name).join('; '));
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
