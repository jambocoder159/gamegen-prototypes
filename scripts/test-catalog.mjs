#!/usr/bin/env node
// Catalog landing-page checks: links, covers, axe-core a11y, overflow,
// console cleanliness, keyboard focus, accessible names, reduced motion.
// Deps: puppeteer-core + axe-core (already installed). No others.

import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_PATH = '/gamegen-prototypes/';
const CHROME = '/usr/bin/google-chrome';
const AXE_PATH = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js');
const SHOTS_DIR = process.env.CATALOG_SHOTS || '/workspace/gamegen-games/_reports';
const WIDTHS = [320, 375, 768, 1024, 1440];

const GAMES = [
  { id: 'mochi-merge',  name: '麻糬合成' },
  { id: 'lantern-rise', name: '孔明燈升空' },
  { id: 'noodle-night', name: '夜市麵攤' },
  { id: 'shelf-sort',   name: '貨架理貨' },
  { id: 'tap-garden',   name: '芽芽花園' },
  { id: 'mahjong-deck', name: '麻將牌組' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

let failures = 0;
function pass(msg) { console.log('PASS: ' + msg); }
function fail(msg) { console.log('FAIL: ' + msg); failures++; }

// ---- tiny static server rooted under BASE_PATH ----
function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(BASE_PATH)) {
        res.writeHead(404); res.end('not under base path'); return;
      }
      let rel = pathname.slice(BASE_PATH.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      // prevent path traversal
      const full = path.join(ROOT, rel);
      if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
      let s;
      try { s = await stat(full); } catch { res.writeHead(404); res.end('not found'); return; }
      let filePath = full;
      if (s.isDirectory()) filePath = path.join(full, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  await mkdir(SHOTS_DIR, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const pageUrl = origin + BASE_PATH;          // .../gamegen-prototypes/
  const axeSource = await readFile(AXE_PATH, 'utf8');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const consoleIssues = [];
  const failedRequests = [];
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning' || t === 'warn') {
      consoleIssues.push(`[${t}] ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => consoleIssues.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    failedRequests.push(`${r.url()} — ${r.failure()?.errorText || 'failed'}`);
  });

  try {
    await page.setViewport({ width: 1024, height: 900 });
    const resp = await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // (a) index + each game link 200, game pages are HTML with id="root"
    if (resp && resp.status() === 200) pass('index.html returns 200');
    else fail(`index.html status ${resp && resp.status()}`);

    const playHrefs = await page.$$eval('a.btn--play', (as) => as.map((a) => a.getAttribute('href')));
    if (playHrefs.length === 6) pass('found 6 primary game links');
    else fail(`expected 6 primary links, found ${playHrefs.length}`);

    for (let i = 0; i < GAMES.length; i++) {
      const href = playHrefs[i];
      const abs = href ? new URL(href, pageUrl).href : null;
      if (!abs) { fail(`missing link for ${GAMES[i].id}`); continue; }
      try {
        const r = await fetch(abs);
        const body = await r.text();
        if (r.status === 200 && /id=["']root["']/.test(body)) {
          pass(`game link ${GAMES[i].id} -> 200 + id="root"`);
        } else {
          fail(`game link ${GAMES[i].id} status ${r.status}, hasRoot=${/id=["']root["']/.test(body)}`);
        }
      } catch (e) {
        fail(`game link ${GAMES[i].id} fetch error: ${e.message}`);
      }
    }

    // (b) all six covers loaded
    const coverWidths = await page.$$eval('img.card__cover', (imgs) => imgs.map((i) => i.naturalWidth));
    if (coverWidths.length === 6 && coverWidths.every((w) => w > 0)) {
      pass('all 6 cover images loaded (naturalWidth > 0)');
    } else {
      fail(`cover images: count=${coverWidths.length}, widths=${JSON.stringify(coverWidths)}`);
    }

    // inject axe once
    await page.evaluate(axeSource);

    // (c) + (d) per width
    const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: 900 });
      await new Promise((r) => setTimeout(r, 120));

      const results = await page.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
        return r.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
        }));
      }, axeTags);

      if (results.length === 0) {
        pass(`axe 0 violations @ ${w}px`);
      } else {
        fail(`axe ${results.length} violation(s) @ ${w}px`);
        for (const v of results) {
          console.log(`      - [${v.impact}] ${v.id}: ${v.help}`);
          for (const n of v.nodes) console.log(`          ${n}`);
        }
      }

      const overflow = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      if (overflow.sw <= overflow.iw) pass(`no horizontal overflow @ ${w}px`);
      else fail(`horizontal overflow @ ${w}px (scrollWidth ${overflow.sw} > innerWidth ${overflow.iw})`);
    }

    // (f) keyboard: first Tab -> skip link; every link/button gets visible focus ring
    await page.setViewport({ width: 1024, height: 900 });
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.keyboard.press('Tab');
    const firstIsSkip = await page.evaluate(() =>
      !!document.activeElement && document.activeElement.classList.contains('skip-link'));
    if (firstIsSkip) pass('first Tab focuses the skip link');
    else fail('first Tab did not focus the skip link');

    const focusCount = await page.$$eval('a[href], button', (els) => els.length);
    const badFocus = [];
    for (let i = 0; i < focusCount; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { ok: false, label: '(none)' };
        const cs = getComputedStyle(el);
        const ow = parseFloat(cs.outlineWidth) || 0;
        const bs = cs.boxShadow;
        const ok = (cs.outlineStyle !== 'none' && ow >= 2) || (bs && bs !== 'none');
        return { ok, ow, bs, label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24) };
      });
      if (!info.ok) badFocus.push(info.label + ` (outline ${info.ow}px, shadow ${info.bs})`);
      await page.keyboard.press('Tab');
    }
    if (badFocus.length === 0) pass(`all ${focusCount} focusable elements show a visible focus ring`);
    else fail(`elements without visible focus ring: ${badFocus.join('; ')}`);

    // (g) primary link accessible names contain 開始玩 + the Chinese name
    const names = await page.$$eval('a.btn--play', (as) =>
      as.map((a) => a.getAttribute('aria-label') || a.textContent.trim()));
    let gOk = names.length === 6;
    for (let i = 0; i < GAMES.length; i++) {
      const n = names[i] || '';
      const vis = '開始玩';
      if (!(n.includes(vis) && n.includes(GAMES[i].name))) {
        gOk = false;
        fail(`primary link name for ${GAMES[i].id} = "${n}" (missing 開始玩 or name)`);
      }
    }
    if (gOk) pass('all primary links expose accessible name 「開始玩」 + game name');

    // (h) prefers-reduced-motion: card durations are 0 / none
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await new Promise((r) => setTimeout(r, 80));
    const motion = await page.evaluate(() => {
      const zeroed = (val) => val.split(',').every((p) => {
        const t = p.trim();
        return t === '0s' || t === '0ms' || t === 'none' || t === '';
      });
      const out = [];
      document.querySelectorAll('.card, .cards__item').forEach((el) => {
        const cs = getComputedStyle(el);
        out.push({
          ad: cs.animationDuration, td: cs.transitionDuration,
          ok: zeroed(cs.animationDuration) && zeroed(cs.transitionDuration),
        });
      });
      return out;
    });
    if (motion.length && motion.every((m) => m.ok)) {
      pass('reduced-motion: card animation/transition durations are 0/none');
    } else {
      const bad = motion.filter((m) => !m.ok)[0];
      fail(`reduced-motion: non-zero duration found (anim ${bad?.ad}, trans ${bad?.td})`);
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // (e) console / network cleanliness
    if (consoleIssues.length === 0) pass('no console errors/warnings');
    else { fail(`console issues (${consoleIssues.length})`); consoleIssues.forEach((c) => console.log('      ' + c)); }
    if (failedRequests.length === 0) pass('no failed requests');
    else { fail(`failed requests (${failedRequests.length})`); failedRequests.forEach((c) => console.log('      ' + c)); }

    // screenshots — scroll through + await decode so below-fold covers paint
    const settle = async () => {
      await page.evaluate(async () => {
        await new Promise((res) => {
          let y = 0;
          const step = () => {
            window.scrollBy(0, Math.round(window.innerHeight * 0.8));
            y += window.innerHeight * 0.8;
            if (y < document.body.scrollHeight) setTimeout(step, 50);
            else { window.scrollTo(0, 0); res(); }
          };
          step();
        });
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      });
      await new Promise((r) => setTimeout(r, 300));
    };

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(pageUrl, { waitUntil: 'networkidle0' });
    await settle();
    const mobileShot = path.join(SHOTS_DIR, 'catalog-mobile-390.png');
    await page.screenshot({ path: mobileShot, fullPage: true });
    pass(`wrote ${mobileShot}`);

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(pageUrl, { waitUntil: 'networkidle0' });
    await settle();
    const desktopShot = path.join(SHOTS_DIR, 'catalog-desktop-1440.png');
    await page.screenshot({ path: desktopShot, fullPage: true });
    pass(`wrote ${desktopShot}`);

  } finally {
    await browser.close();
    server.close();
  }

  console.log('');
  if (failures === 0) {
    console.log('ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log(`${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.log('FAIL: harness error: ' + (e && e.stack || e));
  process.exit(1);
});
