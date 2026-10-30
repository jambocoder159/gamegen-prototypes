// Title / loading layout QA. Builds, serves with `vite preview` on its own port,
// and for a matrix of desktop, landscape-phone and portrait viewports checks that
// the title screen fits the viewport: every button (primary
// first) fully on screen, no document scroll in either axis, no title art larger
// than the viewport, key art on screen and not covering the primary button, no
// text overflow in the longest languages. Screenshots go to ../_reports/.
// Prints PASS/FAIL per check and exits 1 on any failure.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

// --- per-game configuration ---------------------------------------------------
const GAME = 'mochi-merge';
const DEFAULT_PORT = 4311;
const LANG_KEY = 'mochi.lang';
const SCREENS = [
  {
    id: 'title',
    root: '.title',
    primary: '.btn--play',
    art: ['.title__logo'],
    text: ['.title__name', '.title__tagline', '.btn--play', '.btn--new', '.catalog-link'],
  },
];
// ------------------------------------------------------------------------------

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reports = join(root, '..', '_reports');
mkdirSync(reports, { recursive: true });

const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const BASE_URL = `http://localhost:${PORT}/`;
const CHROME = '/usr/bin/google-chrome';
const VIEWPORTS = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [844, 390],
  [667, 375],
  [390, 844],
  [375, 812],
  [360, 640],
];
// Tightest viewports are re-checked in every language for text fit.
const LANG_VIEWPORTS = ['844x390', '667x375', '360x640'];
const LANGS = ['en', 'zh-tw', 'zh-cn', 'ja'];

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

// Runs in the page: measures one screen and returns a list of problems.
function measure(screen) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const problems = [];
  const desc = (el) =>
    (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : el.tagName);
  const inside = (r) => r.top >= 0 && r.left >= 0 && r.bottom <= H && r.right <= W;
  const fmt = (r) => `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`;
  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };

  const de = document.documentElement;
  if (de.scrollHeight > H + 1) problems.push(`document scrollHeight ${de.scrollHeight} > ${H}`);
  if (de.scrollWidth > W + 1) problems.push(`document scrollWidth ${de.scrollWidth} > ${W}`);

  const rootEl = document.querySelector(screen.root);
  if (!rootEl) return [`screen root ${screen.root} missing`];

  const primary = document.querySelector(screen.primary);
  let primaryRect = null;
  if (!primary) problems.push(`primary ${screen.primary} missing`);
  else {
    primaryRect = primary.getBoundingClientRect();
    if (!inside(primaryRect)) problems.push(`primary ${screen.primary} outside viewport ${fmt(primaryRect)}`);
    if (primaryRect.height < 48 || primaryRect.width < 48) problems.push(`primary smaller than 48px ${fmt(primaryRect)}`);
  }

  if (!rootEl.querySelector('a.catalog-link[href="../"]')) problems.push('catalog link missing');
  for (const b of rootEl.querySelectorAll('button, a[href]')) {
    if (!visible(b)) continue;
    const r = b.getBoundingClientRect();
    if (!inside(r)) problems.push(`button ${desc(b)} outside viewport ${fmt(r)}`);
    if (r.width < 48 || r.height < 48) problems.push(`button ${desc(b)} smaller than 48px ${fmt(r)}`);
  }

  const link = rootEl.querySelector('.catalog-link')?.getBoundingClientRect();
  if (link) for (const el of rootEl.querySelectorAll('.title__name, .title__tagline, button')) {
    const r = el.getBoundingClientRect();
    if (link.left < r.right && link.right > r.left && link.top < r.bottom && link.bottom > r.top)
      problems.push(`catalog link overlaps ${desc(el)}`);
  }

  for (const el of rootEl.querySelectorAll('img, .art, [class*="art--fallback"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > W + 1 || r.height > H + 1) problems.push(`art ${desc(el)} larger than viewport ${fmt(r)}`);
  }

  for (const sel of screen.art) {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!inside(r)) problems.push(`key art ${sel} outside viewport ${fmt(r)}`);
      for (const textSelector of screen.text.filter(sel => sel !== screen.primary)) {
        const text = document.querySelector(textSelector)?.getBoundingClientRect();
        if (text && r.left < text.right && r.right > text.left && r.top < text.bottom && r.bottom > text.top)
          problems.push(`key art ${sel} overlaps title text ${textSelector}`);
      }
      if (primaryRect) {
        const overlap =
          r.left < primaryRect.right - 1 &&
          r.right > primaryRect.left + 1 &&
          r.top < primaryRect.bottom - 1 &&
          r.bottom > primaryRect.top + 1;
        if (overlap) problems.push(`key art ${sel} overlaps primary button`);
      }
    }
  }

  for (const sel of screen.text) {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1) problems.push(`text overflow ${sel}: "${el.textContent}"`);
      const r = el.getBoundingClientRect();
      if (!inside(r)) problems.push(`text ${sel} outside viewport ${fmt(r)}`);
    }
  }
  return problems;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))),
    );
  });
  await sleep(350);
}

async function runViewport(browser, w, h, lang) {
  const tag = `${w}x${h}${lang === 'en' ? '' : ' ' + lang}`;
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument(
      (key, value) => {
        try {
          localStorage.setItem(key, value);
          if (!location.hash) localStorage.removeItem('mochi.run');
        } catch {
          /* ignore */
        }
      },
      LANG_KEY,
      lang,
    );
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await page.waitForFunction((expected) => document.documentElement.lang.toLowerCase() === expected, {}, lang);

    for (let i = 0; i < SCREENS.length; i++) {
      const screen = SCREENS[i];
      try {
        await page.waitForSelector(`${screen.root} ${screen.primary}`, { visible: true, timeout: 20000 });
      } catch {
        check(`${tag} ${screen.id}: screen reached`, false, `${screen.primary} never appeared`);
        return;
      }
      await settle(page);
      const problems = await page.evaluate(measure, screen);
      check(`${tag} ${screen.id}: fits viewport`, problems.length === 0, problems.slice(0, 6).join(' | '));
      if (lang === 'en') {
        const suffix = screen.id === 'title' ? '' : `_${screen.id}`;
        await page.screenshot({ path: join(reports, `fix_${GAME}_title_${w}x${h}${suffix}.png`) });
      }
      if (i < SCREENS.length - 1) await page.click(`${screen.root} ${screen.primary}`);
    }
    // Also reserve enough room when a saved run adds Continue / New game.
    // Use the public save format, then let the title read and validate it.
    await page.evaluate(() => {
      const grid=Array.from({length:4},()=>Array(4).fill(null));
      grid[0][0]={id:1,tier:1,row:0,col:0};grid[0][1]={id:2,tier:1,row:0,col:1};
      localStorage.setItem('mochi.run',JSON.stringify({version:1,best:0,newBest:false,state:{grid,score:0,over:false,won:false,keepGoing:false,seed:1,nextId:3,moves:0}}));
    });
    // Do not rerun the initial-language setup, which intentionally clears saves.
    await page.evaluate(() => { location.hash='continue'; });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.btn--new');
    await settle(page);
    const problems = await page.evaluate(measure, SCREENS[0]);
    check(`${tag} Continue title: fits viewport`, problems.length===0, problems.slice(0,6).join(' | '));
    if(lang==='en')await page.screenshot({path:join(reports,`fix_${GAME}_continue_${w}x${h}.png`)});
  } finally {
    await page.close();
  }
}

async function main() {
  if (!process.env.SKIP_BUILD) {
    console.log('Building…');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }
  console.log(`Starting preview on ${PORT}…`);
  const server = spawn(
    process.execPath,
    [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: 'pipe' },
  );
  let serverError = '';
  server.stderr.on('data', (chunk) => { serverError += chunk; });
  server.on('error', (error) => { serverError += error.message; });
  try {
    const up = await waitForServer(BASE_URL);
    if (server.exitCode !== null || serverError) throw new Error(`Preview failed: ${serverError}`);
    check('preview server is up', up);
    if (up) {
      const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
      });
      try {
        for (const [w, h] of VIEWPORTS) {
          await runViewport(browser, w, h, 'en');
          if (LANG_VIEWPORTS.includes(`${w}x${h}`)) {
            for (const lang of LANGS.slice(1)) await runViewport(browser, w, h, lang);
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.kill('SIGTERM');
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
