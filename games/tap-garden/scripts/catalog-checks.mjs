import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const reports = join(dirname(fileURLToPath(import.meta.url)), '../../_reports');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const labels = { en: 'Back to catalog', 'zh-tw': '返回目錄', 'zh-cn': '返回目录', ja: 'カタログに戻る' };

// Exercise the shipped app at its real one-directory-deep mount. A 204 catalog
// response lets native navigation run without replacing the test document.
export async function catalogChecks(browser, url, check, axePath) {
  mkdirSync(reports, { recursive: true });
  for (const [lang, label] of Object.entries(labels)) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const issues = [];
    page.on('pageerror', e => issues.push(e.message));
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(m.text()); });
    const parent = new URL('../', url).href;
    const requests = [];
    let navigation;
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url() === parent) {
        requests.push(request.url());
        await request.respond({ status: 204 });
        // Capture happened during click dispatch, before any navigation lifecycle
        // event. Release interception before reading it to avoid a CDP deadlock.
        const snapshot = await page.evaluate(() => window.__catalogSavedBeforeNavigation);
        navigation?.(snapshot);
      } else await request.continue();
    });
    async function activate(keyboard) {
      const saved = new Promise(resolve => { navigation = resolve; });
      const started = Date.now();
      if (keyboard) await page.keyboard.press('Enter');
      else await page.click('.catalog-link');
      const snapshot = await Promise.race([saved, sleep(5000).then(() => { throw new Error('Catalog navigation was not requested'); })]);
      navigation = null;
      return { snapshot, started };
    }
    async function tabToLink() {
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => document.activeElement?.matches('.catalog-link'))) return true;
      }
      return false;
    }
    async function inspect(where, width) {
      const data = await page.$eval('.catalog-link', el => {
        const r = el.getBoundingClientRect(), c = getComputedStyle(el);
        const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = s => rgb(s).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
        const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
        return {
          href: el.getAttribute('href'), resolved: el.href, text: el.textContent.trim(),
          inside: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          fit: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
          height: r.height, ring: el.matches(':focus-visible') && parseFloat(c.outlineWidth) >= 3 && c.outlineStyle === 'solid' && contrast(c.outlineColor, c.backgroundColor) >= 3,
          guarded: c.userSelect === 'none' && c.webkitTapHighlightColor === 'rgba(0, 0, 0, 0)',
        };
      });
      const accessible = await page.$(`::-p-aria(${label}[role="link"])`);
      check(`catalog ${where} ${lang} ${width}: relative URL and accessible translated name`, data.href === '../' && data.resolved === parent && data.text === label && !!accessible, JSON.stringify(data));
      check(`catalog ${where} ${lang} ${width}: 48px target, no overflow, focus contrast and gesture guards`, data.inside && data.fit && data.height >= 48 && data.ring && data.guarded, JSON.stringify(data));
    }
    async function axe(where, width) {
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      check(`catalog axe ${where} ${lang} ${width}: zero violations`, !violations.length, JSON.stringify(violations));
    }
    try {
      await page.setViewport({ width: 375, height: 812 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      const savedAt = Date.now() - 1000;
      await page.evaluate(({ lang, savedAt }) => {
        localStorage.clear();
        localStorage.setItem('tap-garden.lang', lang);
        localStorage.setItem('tap-garden.coach', 'done');
        localStorage.setItem('tap-garden.save', JSON.stringify({ v: 2, dew: 321, plots: [2, ...Array(15).fill(0)], upgrades: Array(8).fill(0), relics: Array(12).fill(0), unlocked: 9, stage: 1, celebrated: true, savedAt }));
      }, { lang, savedAt });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('.btn--enter'); await page.click('.btn--enter');
      await page.waitForSelector('.catalog-link');
      await page.evaluate(() => window.addEventListener('click', event => {
        if (event.target.closest('.catalog-link')) {
          window.__catalogSavedBeforeNavigation = JSON.parse(localStorage.getItem('tap-garden.save'));
        }
      }));
      for (const [width, height] of [[375, 812], [1440, 900]]) {
        await page.setViewport({ width, height }); await sleep(150);
        check(`catalog title ${lang} ${width}: reachable by Tab`, await tabToLink());
        await inspect('title', width); await axe('title', width);
        if (lang === 'en' && width === 1440) await page.screenshot({ path: join(reports, 'back_tap-garden_title.png') });
      }
      const title = await activate(true);
      check(`catalog title ${lang}: Enter requests parent and preserves player progress/offline timestamp`, requests.at(-1) === parent && title.snapshot.dew === 321 && title.snapshot.plots[0] === 2 && title.snapshot.savedAt === savedAt, JSON.stringify({ dew: title.snapshot.dew, plant: title.snapshot.plots[0], savedAt: title.snapshot.savedAt, expectedSavedAt: savedAt }));
      await page.click('.btn--play'); await page.waitForSelector('.garden');
      check(`catalog ${lang}: absent from in-play HUD`, await page.$$eval('.garden a[href="../"]', els => els.length) === 0 && !(await page.$('.catalog-link')));
      for (const [width, height] of [[375, 812], [1440, 900]]) {
        await page.setViewport({ width, height }); await sleep(150);
        await page.click('.btn--settings'); await page.waitForSelector('.dialog--settings');
        await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
        check(`catalog settings ${lang} ${width}: Shift+Tab wraps to link`, await page.evaluate(() => document.activeElement.matches('.catalog-link')));
        await inspect('settings', width); await axe('settings', width);
        if (lang === 'en' && width === 1440) await page.screenshot({ path: join(reports, 'back_tap-garden_pause.png') });
        await page.keyboard.press('Tab');
        check(`catalog settings ${lang} ${width}: Tab wraps to close`, await page.evaluate(() => document.activeElement.matches('.dialog__close')));
        check(`catalog settings ${lang} ${width}: forward Tab reaches link within dialog`, await tabToLink() && await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')));
        await page.keyboard.press('Escape');
        check(`catalog settings ${lang} ${width}: closing restores opener`, await page.evaluate(() => document.activeElement.matches('.btn--settings')));
      }
      await page.click('.btn--settings');
      await tabToLink();
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tap-garden.save')));
      await sleep(250);
      const play = await activate(lang !== 'en');
      check(`catalog settings ${lang}: synchronous live snapshot before native navigation`, requests.length === 2 && requests.every(r => r === parent) && play.snapshot.savedAt >= play.started && play.snapshot.dew > before.dew && play.snapshot.stats.seconds > before.stats.seconds && play.snapshot.plots[0] === 2 && play.snapshot.celebrated, JSON.stringify({ savedAt: play.snapshot.savedAt, clickAt: play.started, dew: play.snapshot.dew, previousDew: before.dew, seconds: play.snapshot.stats.seconds, previousSeconds: before.stats.seconds }));
      check(`catalog ${lang}: no console errors or warnings`, !issues.length, issues.join(' | '));
    } finally { await context.close(); }
  }
}
