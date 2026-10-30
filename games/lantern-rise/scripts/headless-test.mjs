// Headless QA for Lantern Rise. Builds, serves the production bundle with
// `vite preview`, drives it with a real browser, and asserts the platform
// requirements: clean console/network, preload gate, title demo, playable game
// with changing score, reachable result screen, 4-language switching with no
// text overflow, live re-layout on resize without reload/state loss, and a
// one-image fallback. Screenshots go to qa/. Prints a PASS/FAIL list.

import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { fixChecks } from './fix-checks.mjs';
import { selectionChecks } from './selection-checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const qa = join(repo, 'qa');
const PORT = Number(process.env.PORT) || 4173;
const BASE = `http://localhost:${PORT}/`;
const CHROME = '/usr/bin/google-chrome';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('preview server did not start');
}

const TEXT_SELECTORS = [
  '.lr-title-text',
  '.lr-tagline',
  '.lr-help',
  '.lr-textbtn',
  '.lr-pill-content',
  '.lr-panel-title',
  '.lr-stat',
  '.lr-status-text',
];

async function overflowing(page) {
  return page.evaluate((sels) => {
    const bad = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollWidth > el.clientWidth + 1) {
          bad.push(`${sel} (${el.scrollWidth}>${el.clientWidth}) "${(el.textContent || '').slice(0, 20)}"`);
        }
      }
    }
    return bad;
  }, TEXT_SELECTORS);
}

async function main() {
  mkdirSync(qa, { recursive: true });

  console.log('Building…');
  execSync('npm run build', { cwd: repo, stdio: 'inherit' });

  console.log('Starting preview…');
  const server = spawn(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: repo,
    stdio: 'ignore',
  });

  let browser;
  try {
    await waitForServer(BASE);

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });

    await fixChecks(browser, BASE, check);
    await selectionChecks(browser, BASE, check);

    // ---------- Main session ----------
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

    const consoleIssues = [];
    const failedRequests = [];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') consoleIssues.push(`[${type}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => consoleIssues.push(`[pageerror] ${err.message}`));
    page.on('requestfailed', (req) => failedRequests.push(req.url()));
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await page.goto(BASE, { waitUntil: 'load' });

    // Preload gate: Enter button appears when ready.
    await page.waitForSelector('.lr-enter', { timeout: 20000 });
    check('preload gate reaches ready (Enter button)', true);

    // Loading text was localised at some point (status row uses t('loading')).
    await page.click('.lr-enter');
    await page.waitForSelector('.lr-title', { timeout: 10000 });
    check('title screen shown after Enter', true);
    await sleep(400);
    await page.screenshot({ path: join(qa, 'title.png') });

    // Title demo running: the lantern transform changes over time.
    const t1 = await page.$eval('.lr-lantern', (e) => e.style.transform);
    await sleep(700);
    const t2 = await page.$eval('.lr-lantern', (e) => e.style.transform);
    check('title demo is running (lantern moves)', t1 !== t2, `${t1 ? 'ok' : 'no-transform'}`);

    // Language switching on the title screen: <html lang> changes, no overflow.
    const langBtn = '.lr-corner-tr .lr-iconbtn:last-child';
    const seenLangs = new Set();
    let overflowBad = [];
    for (let i = 0; i < 4; i++) {
      const lang = await page.evaluate(() => document.documentElement.lang);
      seenLangs.add(lang);
      const bad = await overflowing(page);
      overflowBad = overflowBad.concat(bad.map((b) => `${lang}: ${b}`));
      await page.click(langBtn);
      await sleep(250);
    }
    check('all 4 languages reachable', seenLangs.size === 4, [...seenLangs].join(','));
    check('no text overflow across languages', overflowBad.length === 0, overflowBad.slice(0, 3).join(' | '));

    // Start a real game.
    await page.click('.lr-play');
    await page.waitForSelector('.lr-game .lr-playfield', { timeout: 10000 });
    await page.evaluate(() => {
      window.__persist = 'alive-' + Date.now();
    });
    check('game screen started', true);

    // Lantern must never ride up behind the HUD. Hold thrust for 4 s (lantern
    // rises and pins to the soft ceiling) at the portrait and wide design sizes
    // and assert its bounding box never intersects any HUD element box.
    const restartBtn = '.lr-corner-tl .lr-iconbtn:not(.lr-glyphbtn)';
    const sampleLanternVsHud = () =>
      page.evaluate(() => {
        const L = document.querySelector('.lr-lantern');
        if (!L) return null;
        const lr = L.getBoundingClientRect();
        if (lr.width === 0 || lr.height === 0) return null;
        const hud = [...document.querySelectorAll('button, .lr-hud .lr-pill, .lr-meter-wrap')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter((b) => b.r.width > 0 && b.r.height > 0);
        for (const b of hud) {
          const r = b.r;
          const ox = Math.min(lr.right, r.right) - Math.max(lr.left, r.left);
          const oy = Math.min(lr.bottom, r.bottom) - Math.max(lr.top, r.top);
          if (ox > 1 && oy > 1) {
            return `lantern ∩ ${b.el.getAttribute('aria-label') || b.el.className}`;
          }
        }
        return null;
      });

    let lanternHudHit = [];
    for (const [w, h] of [
      [390, 844],
      [1280, 720],
    ]) {
      await page.click(restartBtn); // fresh game => full fuel, lantern mid-screen
      await page.waitForSelector('.lr-game .lr-playfield', { timeout: 10000 });
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await sleep(180);
      await page.focus('body');
      await page.keyboard.down('Space');
      for (let i = 0; i < 40; i++) {
        await sleep(100); // 40 * 100ms = 4s of held thrust
        const hit = await sampleLanternVsHud();
        if (hit) {
          lanternHudHit.push(`${w}x${h}: ${hit}`);
          break;
        }
      }
      await page.keyboard.up('Space');
    }
    check(
      'lantern stays clear of the HUD while thrusting (390x844, 1280x720)',
      lanternHudHit.length === 0,
      lanternHudHit.slice(0, 3).join(' | '),
    );

    // Reset to the portrait design size with a fresh game for the checks below.
    await page.click(restartBtn);
    await page.waitForSelector('.lr-game .lr-playfield', { timeout: 10000 });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(180);

    // Thrust (hold Space) to stay airborne and accumulate distance.
    await page.focus('body');
    await page.keyboard.down('Space');
    await sleep(1000);
    const dist1 = await page.$eval('.lr-pill-value', (e) => Number(e.textContent) || 0);
    await sleep(300);
    await page.screenshot({ path: join(qa, 'gameplay.png') });

    // Resize sweep mid-game: no reload (marker survives), state survives, no clip.
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
    let reloadDetected = false;
    let clipped = [];
    for (const [w, h, dpr] of sizes) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
      await sleep(180);
      const marker = await page.evaluate(() => window.__persist);
      if (!marker) reloadDetected = true;
      const hasField = await page.$('.lr-game .lr-playfield');
      if (!hasField) reloadDetected = true;
      const clip = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const out = [];
        for (const el of document.querySelectorAll('.lr-iconbtn, .lr-glyphbtn')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2) {
            out.push(`btn@${Math.round(r.left)},${Math.round(r.top)} vp ${vw}x${vh}`);
          }
        }
        return out;
      });
      clipped = clipped.concat(clip);
      if (w === 390 && h === 844) await page.screenshot({ path: join(qa, 'portrait.png') });
      if (w === 1280 && h === 720) await page.screenshot({ path: join(qa, 'wide.png') });
      if (w === 626 && h === 890) await page.screenshot({ path: join(qa, 'nearsquare.png') });
    }
    check('no reload during resize sweep', !reloadDetected);
    check('controls stay within viewport on all sizes', clipped.length === 0, clipped.slice(0, 2).join(' | '));

    // Top HUD must never overlap: every interactive control (button) and info
    // pill (.lr-hud .lr-pill) in the portrait layout must have a disjoint box.
    const hudSizes = [
      [360, 640],
      [375, 812],
      [390, 844],
      [466, 678],
      [626, 890],
    ];
    let hudOverlap = [];
    for (const [w, h] of hudSizes) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await sleep(180);
      const over = await page.evaluate(() => {
        const name = (el) =>
          el.getAttribute('aria-label') || el.className || el.tagName.toLowerCase();
        const boxes = [...document.querySelectorAll('button, .lr-hud .lr-pill')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter((b) => b.r.width > 0 && b.r.height > 0);
        const hits = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i].r;
            const b = boxes[j].r;
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ox > 1 && oy > 1) hits.push(`${name(boxes[i].el)} ∩ ${name(boxes[j].el)}`);
          }
        }
        return hits;
      });
      hudOverlap = hudOverlap.concat(over.map((o) => `${w}x${h}: ${o}`));
    }
    check('no HUD element overlap in portrait sizes', hudOverlap.length === 0, hudOverlap.slice(0, 3).join(' | '));

    // Distance (score/progress) increased while playing.
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await sleep(150);
    const dist2 = await page.$eval('.lr-pill-value', (e) => Number(e.textContent) || 0);
    check('distance/score increases during play', dist2 > dist1, `${dist1} -> ${dist2}`);

    // Stop thrusting; fuel runs out, lantern falls, game over → result screen.
    await page.keyboard.up('Space');
    await page.waitForSelector('.lr-result', { timeout: 20000 });
    check('game over / result screen reachable', true);
    const resultOverflow = await overflowing(page);
    check('no text overflow on result screen', resultOverflow.length === 0, resultOverflow.slice(0, 2).join(' | '));
    await page.screenshot({ path: join(qa, 'result.png') });

    // Restart works.
    await page.click('.lr-result .lr-primary');
    await page.waitForFunction(() => !document.querySelector('.lr-result'), { timeout: 10000 });
    check('restart from result returns to play', true);

    check('no console errors/warnings', consoleIssues.length === 0, consoleIssues.slice(0, 3).join(' | '));
    check('no failed network requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

    // ---------- Fallback session: block one image ----------
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page2.setRequestInterception(true);
    let blockedOne = false;
    page2.on('request', (req) => {
      if (!blockedOne && /deco_storm\.png/.test(req.url())) {
        blockedOne = true;
        req.abort();
      } else {
        req.continue();
      }
    });
    await page2.goto(BASE, { waitUntil: 'load' });
    const startedWithFallback = await page2
      .waitForSelector('.lr-enter', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    check('game still starts with one blocked image', startedWithFallback && blockedOne);
    await page2.close();
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    process.exit(1);
  }
  console.log('All headless checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
