import { join, extname } from 'node:path';
import { readFileSync } from 'node:fs';

const labels = { en: 'Back to catalog', 'zh-tw': '返回目錄', 'zh-cn': '返回目录', ja: 'カタログに戻る' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function enter(page) {
  await page.waitForSelector('.btn--enter');
  await page.click('.btn--enter');
  await page.waitForSelector('.title .catalog-link');
}

async function auditLink(page, selector, label, check, tag) {
  const data = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    return { href: el.getAttribute('href'), url: el.href, text: el.textContent.trim(),
      fits: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 &&
        r.height >= 48 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
  });
  const client = await page.createCDPSession();
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { nodes } = await client.send('Accessibility.getPartialAXTree', { nodeId });
  const accessibleName = nodes.find(node => node.role?.value === 'link')?.name?.value;
  await client.detach();
  check(`catalog ${tag}: relative parent URL, translated accessible name and 48px fit`,
    data.href === '../' && data.url === new URL('../', page.url()).href && data.text === label &&
    accessibleName === data.text && data.fits, JSON.stringify({ ...data, accessibleName }));

  let reached = false;
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    if (await page.$eval(selector, el => el === document.activeElement)) { reached = true; break; }
  }
  const ring = await page.$eval(selector, el => {
    const s = getComputedStyle(el);
    const luminance = color => {
      const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminance(s.outlineColor), b = luminance(s.backgroundColor);
    return el.matches(':focus-visible') && parseFloat(s.outlineWidth) >= 3 && s.outlineStyle === 'solid' &&
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3;
  });
  check(`catalog ${tag}: Tab reaches link with a 3px contrasting focus ring`, reached && ring);
}

export async function catalogChecks(browser, origin, check, axeAudit, reports, playToWin) {
  const base = new URL('gamegen-prototypes/shelf-sort/', origin).href;
  const parent = new URL('../', base).href;
  // Mount the built game below a catalog, with its configured shared /common/
  // assets still served by preview at the origin root. Keep the browser URL real.
  const serveGame = async request => {
    if (!request.url().startsWith(base)) return request.continue();
    const path = decodeURIComponent(new URL(request.url()).pathname.slice(new URL(base).pathname.length)) || 'index.html';
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
    await request.respond({ status: 200, contentType: types[extname(path)] || 'application/octet-stream',
      body: readFileSync(new URL('../dist/' + path, import.meta.url)) });
  };
  for (const width of [375, 1440]) {
    for (const [lang, label] of Object.entries(labels)) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      try {
        await page.setViewport({ width, height: width === 375 ? 812 : 900 });
        let resolveClick;
        let clicked;
        await page.exposeFunction('recordCatalogClick', value => resolveClick?.(value));
        await page.evaluateOnNewDocument(lang => {
          if (!localStorage.getItem('catalog-test.seeded')) {
            localStorage.setItem('catalog-test.seeded', 'yes');
            localStorage.setItem('shelf-sort.lang', lang);
            localStorage.setItem('shelf-sort.coach.v1', 'done');
            localStorage.setItem('shelf-sort.progress', JSON.stringify({ unlocked: 3, stars: [3, 2, ...Array(10).fill(0)] }));
            localStorage.setItem('shelf-sort.run', JSON.stringify({ version: 1, level: 1, path: [{ from: 4, to: 14 }], selected: 1 }));
          }
          window.__catalogWrites = [];
          window.__catalogSuspends = 0;
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) {
            window.__catalogWrites.push(key);
            return setItem.call(this, key, value);
          };
          const suspend = AudioContext.prototype.suspend;
          AudioContext.prototype.suspend = function() {
            window.__catalogSuspends++;
            return suspend.call(this);
          };
          document.addEventListener('click', event => {
            if (!event.target.closest('.catalog-link')) return;
            window.__catalogClick = {
              prevented: event.defaultPrevented,
              run: localStorage.getItem('shelf-sort.run'),
              progress: localStorage.getItem('shelf-sort.progress'),
              writes: [...window.__catalogWrites],
              suspends: window.__catalogSuspends,
            };
            window.recordCatalogClick(window.__catalogClick);
          });
        }, lang);
        await page.setRequestInterception(true);
        let resolveNavigation;
        page.on('request', async request => {
          if (request.isNavigationRequest() && request.url() === parent) {
            const saved = await clicked;
            await request.abort();
            resolveNavigation?.({ url: request.url(), ...saved });
          } else await serveGame(request);
        });
        const leave = async (selector, keyboard, expected, tag) => {
          await page.evaluate(() => { window.__catalogWrites = []; window.__catalogClick = null; });
          clicked = new Promise(resolve => { resolveClick = resolve; });
          const navigation = new Promise(resolve => { resolveNavigation = resolve; });
          if (keyboard) await page.keyboard.press('Enter');
          else await page.click(selector);
          const saved = await Promise.race([navigation, sleep(5000).then(() => null)]);
          check(`catalog ${tag}: ${keyboard ? 'Enter' : 'click'} saves synchronously before native parent navigation and suspends audio`,
            saved?.url === parent && !saved.prevented && saved.run === expected &&
            JSON.parse(saved.progress).unlocked === 3 && saved.writes.includes('shelf-sort.progress') &&
            (expected === null || saved.writes.includes('shelf-sort.run')) && saved.suspends > 0,
            saved ? JSON.stringify(saved) : 'No catalog navigation request');
          await sleep(100);
        };

        await page.goto(base, { waitUntil: 'networkidle0' });
        await enter(page);
        const tag = `${lang} ${width}`;
        check(`catalog title ${tag}: saved run offers Continue and New game`, !!await page.$('.btn--new'));
        await auditLink(page, '.title .catalog-link', label, check, `title ${tag}`);
        if (lang === 'en') {
          await axeAudit(page, `catalog title ${width}`);
          if (width === 1440) await page.screenshot({ path: join(reports, 'back_shelf-sort_title.png') });
        }
        const titleRun = await page.evaluate(() => localStorage.getItem('shelf-sort.run'));
        await leave('.title .catalog-link', true, titleRun, `title ${tag}`);

        await page.goto(base, { waitUntil: 'networkidle0' });
        await enter(page);
        await page.click('.btn--play');
        await page.waitForSelector('.game .slot');
        check(`catalog play ${tag}: no catalog link in HUD or playfield`, await page.$$eval('.game .catalog-link', els => els.length) === 0);
        const run = await page.evaluate(() => localStorage.getItem('shelf-sort.run'));
        const board = await page.$$eval('.game .slot', els => els.map(el => el.getAttribute('aria-label')).join('|'));
        await page.click('.game__controls .btn--levels');
        await page.waitForSelector('dialog[open] .catalog-link');
        await auditLink(page, 'dialog .catalog-link', label, check, `Levels ${tag}`);
        await page.keyboard.press('Tab');
        // Chromium may visit the document focus stop before wrapping inside a native dialog.
        if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab');
        const forward = await page.evaluate(() => document.activeElement === document.querySelector('.levelcell'));
        await page.keyboard.down('Shift');
        await page.keyboard.press('Tab');
        await page.keyboard.up('Shift');
        const backward = await page.$eval('dialog .catalog-link', el => document.activeElement === el);
        check(`catalog Levels ${tag}: Tab and Shift+Tab wrap inside dialog`, forward && backward);
        if (lang === 'en') {
          if (width === 375) {
            for (const [w, h] of [[1280,720],[1440,900],[1920,1080],[844,390],[667,375],[390,844],[360,640]]) {
              await page.setViewport({ width: w, height: h });
              await sleep(120);
              const fits = await page.$eval('dialog .catalog-link', el => {
                const r = el.getBoundingClientRect();
                const controls = [...el.closest('.panel').querySelectorAll('button, a, h2')];
                return r.height >= 48 && controls.every(control => {
                  const b = control.getBoundingClientRect();
                  return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
                });
              });
              check(`catalog Levels ${w}x${h}: link and menu controls fit`, fits);
            }
            await page.setViewport({ width, height: 812 });
          }
          await axeAudit(page, `catalog Levels ${width}`);
          if (width === 1440) await page.screenshot({ path: join(reports, 'back_shelf-sort_pause.png') });
        }
        await page.keyboard.press('Escape');
        check(`catalog Levels ${tag}: Escape restores focus to Levels`, await page.$eval('.btn--levels', el => el === document.activeElement));
        await page.click('.btn--levels');
        await page.waitForSelector('dialog[open] .catalog-link');
        // Prove that the click itself writes the current run, even if storage was lost after opening.
        await page.evaluate(() => localStorage.removeItem('shelf-sort.run'));
        if (width === 375) {
          for (let i = 0; i < 35; i++) {
            if (await page.$eval('dialog .catalog-link', el => el === document.activeElement)) break;
            await page.keyboard.press('Tab');
          }
        }
        await leave('dialog .catalog-link', width === 375, run, `Levels ${tag}`);
        // A recovered run must retain its board, selected item, move count and undo history.
        await page.goto(base, { waitUntil: 'networkidle0' });
        await enter(page);
        await page.click('.btn--play');
        await page.waitForSelector('.game .slot');
        check(`catalog ${tag}: saved selection and undo history recover`,
          await page.$eval('[data-slot="1"]', el => el.getAttribute('aria-pressed') === 'true') &&
          await page.$eval('.hud .pill:last-child .pill__value', el => el.textContent === '1') &&
          await page.$$eval('.game .slot', els => els.map(el => el.getAttribute('aria-label')).join('|')) === board);
        await page.keyboard.press('z');
        check(`catalog ${tag}: recovered undo is playable`, await page.$eval('.hud .pill:last-child .pill__value', el => el.textContent === '0'));
      } finally {
        await context.close();
      }
    }
  }

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    let recordFinished;
    const finishedClick = new Promise(resolve => { recordFinished = resolve; });
    await page.exposeFunction('recordFinishedClick', value => recordFinished(value));
    await page.evaluateOnNewDocument(() => document.addEventListener('click', event => {
      if (event.target.closest('.catalog-link')) window.recordFinishedClick({
        run: localStorage.getItem('shelf-sort.run'), progress: localStorage.getItem('shelf-sort.progress'),
      });
    }));
    await page.setRequestInterception(true);
    let resolveFinished;
    page.on('request', async request => {
      if (request.isNavigationRequest() && request.url() === parent) {
        const saved = await finishedClick;
        await request.abort();
        resolveFinished?.(saved);
      } else await serveGame(request);
    });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await enter(page);
    await page.click('.btn--play');
    await page.waitForSelector('.game .slot');
    check('catalog finished run: complete level through gameplay', await playToWin(page));
    await page.click('.panel--win .panel__actions .btn:last-child');
    await page.waitForSelector('dialog[open] .catalog-link');
    const progress = await page.evaluate(() => localStorage.getItem('shelf-sort.progress'));
    const navigation = new Promise(resolve => { resolveFinished = resolve; });
    await page.click('dialog .catalog-link');
    const saved = await Promise.race([navigation, sleep(5000).then(() => null)]);
    check('catalog finished run: preserves earned progress without writing a completed snapshot', saved?.run === null && saved?.progress === progress && JSON.parse(progress).unlocked === 2);
  } finally {
    await context.close();
  }
}
