import { check, sleep, axe, reports } from './browser-utils.mjs';
import { logic as L } from './load-logic.mjs';

const labels = { en: 'Back to catalog', 'zh-tw': '返回目錄', 'zh-cn': '返回目录', ja: 'カタログに戻る' };
const selector = '.catalog-link';
function linkDetails() {
  const link = document.querySelector('.catalog-link'), r = link.getBoundingClientRect();
  return {
    href: link.getAttribute('href'), resolved: link.href,
    parent: new URL('../', location.href).href, text: link.textContent.trim(),
    fits: link.scrollWidth <= link.clientWidth + 1 && r.height >= 48 &&
      r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
    guarded: getComputedStyle(link).userSelect === 'none' && getComputedStyle(link).webkitTapHighlightColor === 'rgba(0, 0, 0, 0)',
  };
}
function focusRing() {
  const link = document.activeElement, css = getComputedStyle(link);
  const luminance = color => {
    const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
      v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const light = luminance(css.outlineColor), dark = luminance(getComputedStyle(link.parentElement).backgroundColor);
  // Parent can be transparent; the solid secondary button is also adjacent to the ring.
  const button = luminance(css.backgroundColor);
  return link.matches('.catalog-link:focus-visible') && parseFloat(css.outlineWidth) >= 3 && css.outlineStyle === 'solid' &&
    (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05) >= 3 &&
    (Math.max(light, button) + .05) / (Math.min(light, button) + .05) >= 3;
}

export async function catalogChecks(browser, url) {
  for (const [lang, label] of Object.entries(labels)) for (const width of [375, 1440]) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    const prefix = 'gamegen-prototypes/match-hero/', parent = new URL('gamegen-prototypes/', url).href;
    const requests = [];
    let beforeNavigation;
    try {
      await page.setViewport({ width, height: width === 375 ? 812 : 900 });
      await page.evaluateOnNewDocument(lang => localStorage.setItem('match-hero.lang', lang), lang);
      await page.setRequestInterception(true);
      page.on('request', async request => {
        if (request.isNavigationRequest() && request.url() === parent) {
          // 204 preserves the document while exercising the browser's native anchor navigation.
          requests.push(request.url());
          await request.respond({ status: 204 });
        } else if (request.url().startsWith(url + prefix)) {
          await request.continue({ url: url + request.url().slice((url + prefix).length) });
        } else await request.continue();
      });
      const run = L.newRun(L.seeded(73));
      run.gold = 123; run.totalGold = 123;
      await page.goto(url + prefix + '?qa=1');
      await page.waitForSelector(selector);
      await page.evaluate((key, value) => localStorage.setItem(key, value), L.SAVE_KEY, L.serialize(run));
      await page.reload();
      await page.waitForSelector(selector);
      await page.evaluate(key => document.addEventListener('click', event => {
        if (event.target.closest('.catalog-link')) window.catalogBeforeNavigation = localStorage.getItem(key);
      }), L.SAVE_KEY);
      for (const screen of ['title', 'settings']) {
        const tag = `${screen} catalog ${lang} ${width}`;
        const d = await page.evaluate(linkDetails);
        check(`${tag}: relative parent URL`, d.href === '../' && d.resolved === d.parent && d.parent === parent);
        check(`${tag}: localized accessible name`, d.text === label && !!await page.$(`aria/${label}[role="link"]`));
        check(`${tag}: 48px target, text fits and gesture guards`, d.fits && d.guarded);
        if (screen === 'title') {
          await page.focus('.btn--play');
          for (let i = 0; i < 6 && !await page.$eval(selector, e => e === document.activeElement); i++) await page.keyboard.press('Tab');
        } else {
          await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
        }
        check(`${tag}: Tab reachable with contrasting 3px focus ring`, await page.evaluate(focusRing));
        if (lang === 'en') await axe(page, tag);
        if (lang === 'zh-tw' && width === 1440) {
          await page.screenshot({ path: `${reports}/back_match-hero_${screen === 'settings' ? 'pause' : 'title'}.png` });
        }
        if (screen === 'settings') {
          await page.keyboard.press('Tab');
          check(`${tag}: Tab wraps to dialog start`, await page.$eval('.modal-close', e => e === document.activeElement));
          await page.keyboard.press('Escape');
          check(`${tag}: Escape restores settings focus`, await page.$eval('.topbar nav button:nth-child(2)', e => e === document.activeElement));
          await page.keyboard.press('Enter');
          await page.waitForSelector('.modal .catalog-link');
          await page.evaluate(() => window.__mh.set({ gold: 4321.125, sp: 77, levels: { ...window.__mh.state.levels, atk: 3 } }));
        }
        const oldCount = requests.length;
        if (screen === 'title') {
          // Force a write of the existing real snapshot; the bot must never replace it.
          await page.evaluate(key => {
            const original = Storage.prototype.setItem;
            window.catalogWrites = 0;
            Storage.prototype.setItem = function(k, v) { if (k === key) window.catalogWrites++; return original.call(this, k, v); };
          }, L.SAVE_KEY);
        }
        if (lang === 'en') {
          await page.focus(selector);
          // Tab back onto the anchor so Enter uses keyboard focus styling too.
          await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
          await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
        } else await page.click(selector);
        for (let i = 0; i < 50 && requests.length === oldCount; i++) await sleep(20);
        check(`${tag}: native navigation requests catalog`, requests.length === oldCount + 1 && requests.at(-1) === parent);
        beforeNavigation = await page.evaluate(() => window.catalogBeforeNavigation);
        const stored = beforeNavigation ? JSON.parse(beforeNavigation) : null;
        check(`${tag}: saves synchronously before navigation`, screen === 'title'
          ? stored?.gold === 123 && JSON.stringify(stored.board) === JSON.stringify(run.board) && await page.evaluate(() => window.catalogWrites) > 0
          : stored?.gold === 4321.125 && stored.sp === 77 && stored.levels.atk === 3 && !stored.defeated && stored.board.length === 36);
        if (screen === 'title') {
          await page.click('.btn--play'); await page.waitForSelector('.board');
          check(`catalog absent from in-play HUD ${lang} ${width}`, await page.$$(selector).then(es => es.length === 0));
          await page.click('.topbar nav button:nth-child(2)');
          await page.waitForSelector('.modal .catalog-link');
        }
      }
    } finally { await context.close(); }
  }
  // Debug adventures must continue preserving the real run when leaving Settings.
  const page = await browser.newPage();
  try {
    await page.goto(url + '?floor=5'); await page.waitForSelector('.btn--play');
    const run = L.serialize(L.newRun(L.seeded(9)));
    await page.evaluate((key, value) => localStorage.setItem(key, value), L.SAVE_KEY, run);
    await page.click('.btn--play'); await page.waitForSelector('.board');
    await page.click('.topbar nav button:nth-child(2)');
    await page.setRequestInterception(true);
    page.on('request', r => r.isNavigationRequest() ? r.respond({ status: 204 }) : r.continue());
    await page.click('.catalog-link');
    check('debug catalog exit preserves real save', await page.evaluate(key => localStorage.getItem(key), L.SAVE_KEY) === run);
  } finally { await page.close(); }
}
