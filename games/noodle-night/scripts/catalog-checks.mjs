import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { axeSource } from './axe-source.mjs';

const labels = { en: 'Back to catalog', 'zh-tw': '返回目錄', 'zh-cn': '返回目录', ja: 'カタログに戻る' };
const viewports = [[1280,720],[1440,900],[1920,1080],[844,390],[667,375],[390,844],[360,640]];

export async function catalogChecks(browser, base, check, reports) {
  const parent = new URL('../', base).href;
  for (const [lang, label] of Object.entries(labels)) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    try {
      await page.setViewport({ width: 375, height: 812 });
      await page.evaluateOnNewDocument(lang => {
        localStorage.setItem('noodle_night_lang', lang);
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (this === localStorage && key === 'noodle_night_run') window.__catalogWrites = (window.__catalogWrites || 0) + 1;
          return setItem.call(this, key, value);
        };
        document.addEventListener('click', event => {
          if (!event.target.closest('a.catalog-link')) return;
          window.__catalogWrites = 0;
          if (window.__removeBeforeCatalog) localStorage.removeItem('noodle_night_run');
        }, true);
        // Bubble after React's delegated handler, before the browser navigates.
        document.addEventListener('click', event => {
          if (!event.target.closest('a.catalog-link')) return;
          window.__catalogClick = {
            raw: localStorage.getItem('noodle_night_run'),
            writes: window.__catalogWrites,
            prevented: event.defaultPrevented,
          };
        });
      }, lang);
      const requests = [];
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.isNavigationRequest() && request.url() === parent) {
          requests.push(request.url());
          // 204 exercises native navigation without replacing the game document.
          void request.respond({ status: 204 });
        } else void request.continue();
      });
      const gate = async () => { await page.goto(base); await page.waitForSelector('.enter-btn'); };
      const title = async () => { await gate(); await page.click('.enter-btn'); await page.waitForSelector('.title-screen'); };
      const linkCheck = async screen => {
        const details = await page.$eval(`${screen} .catalog-link`, el => {
          const r = el.getBoundingClientRect();
          return { href: el.getAttribute('href'), resolved: el.href, text: el.innerText.trim(),
            fits: r.height >= 48 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight };
        });
        const client = await page.createCDPSession();
        const tree = await client.send('Accessibility.getFullAXTree');
        await client.detach();
        const accessible = tree.nodes.filter(n => n.role?.value === 'link' && !n.ignored);
        check(`catalog ${lang} ${screen}: relative parent URL, visible accessible label and fit`,
          details.href === '../' && details.resolved === parent && details.text === label && details.fits && accessible.length === 1 && accessible[0].name.value === details.text, JSON.stringify(details));
        let focused = false;
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab');
          if (await page.$eval(`${screen} .catalog-link`, el => el === document.activeElement)) { focused = true; break; }
        }
        const ring = await page.$eval(`${screen} .catalog-link`, el => {
          const s = getComputedStyle(el);
          const luminance = color => {
            const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
          };
          const a = luminance(s.outlineColor), b = luminance(s.backgroundColor);
          return { visible: el.matches(':focus-visible'), width: parseFloat(s.outlineWidth), style: s.outlineStyle, contrast: (Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
        });
        check(`catalog ${lang} ${screen}: Tab reachable with ≥3px, ≥3:1 focus ring`, focused && ring.visible && ring.width >= 3 && ring.style !== 'none' && ring.contrast >= 3, JSON.stringify(ring));
      };
      const navigate = async (screen, keyboard, expectedRaw = null, remove = false) => {
        await page.evaluate(remove => { window.__catalogClick = null; window.__removeBeforeCatalog = remove; }, remove);
        const count = requests.length;
        const requested = page.waitForRequest(r => r.isNavigationRequest() && r.url() === parent);
        if (keyboard) await page.keyboard.press('Enter');
        else await page.click(`${screen} .catalog-link`);
        await requested;
        const saved = await page.evaluate(() => window.__catalogClick);
        check(`catalog ${lang} ${screen}: ${keyboard ? 'Enter' : 'click'} requests ../ without preventing navigation`, requests.length === count + 1 && requests.at(-1) === parent && saved && !saved.prevented);
        const valid = remove
          ? saved?.writes === 1 && JSON.parse(saved.raw)?.state.status === 'playing' && JSON.parse(saved.raw).state.bowl.join(',') === 'egg,scallion'
          : isDeepStrictEqual(JSON.parse(saved?.raw ?? 'null'), JSON.parse(expectedRaw ?? 'null')) && saved?.writes === (expectedRaw ? 1 : 0);
        check(`catalog ${lang} ${screen}: synchronous save preserves progress without creating finished/demo runs`, valid, valid ? '' : JSON.stringify(saved));
        return saved;
      };
      const axe = async screen => {
        await page.evaluate(axeSource);
        const violations = await page.evaluate(async () => (await window.axe.run()).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
        check(`catalog axe ${lang} ${screen}: zero violations`, !violations.length, JSON.stringify(violations));
      };

      await gate(); await linkCheck('.loading-screen'); await navigate('.loading-screen', true);
      await title(); await linkCheck('.title-screen');
      await page.screenshot({ path: join(reports, `back_noodle-night_title${lang === 'en' ? '' : '_' + lang}.png`) });
      for (const width of [375, 1440]) {
        await page.setViewport({ width, height: width === 375 ? 812 : 900 });
        await axe(`title ${width}`);
      }
      // Use pointer activation too; the keyboard path was exercised at the gate.
      await navigate('.title-screen', false);
      await title(); await page.click('.play-btn'); await page.waitForSelector('.game-screen');
      check(`catalog ${lang}: absent from in-play HUD and playfield`, !(await page.$('.game-screen .catalog-link')));
      await page.keyboard.press('1'); await page.keyboard.press('2'); await page.click('.pause-btn');
      const layoutProblems = [];
      for (const [width, height] of viewports) {
        await page.setViewport({ width, height });
        const bad = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('.help-panel, .help-panel button, .help-panel a')];
          return nodes.filter(el => {
            const r = el.getBoundingClientRect();
            return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || el.scrollWidth > el.clientWidth + 1;
          }).map(el => el.className);
        });
        if (bad.length) layoutProblems.push(`${width}×${height}: ${bad.join(', ')}`);
      }
      check(`catalog ${lang}: pause controls fit all 7 requested viewports`, !layoutProblems.length, layoutProblems.join(' | '));
      await page.setViewport({ width: 375, height: 812 });
      await linkCheck('.help-panel');
      await page.keyboard.press('Tab');
      check(`catalog ${lang}: dialog Tab wraps link to Restart`, await page.$eval('.help-panel .restart-btn', el => el === document.activeElement));
      await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
      check(`catalog ${lang}: dialog Shift+Tab wraps Restart to link`, await page.$eval('.help-panel .catalog-link', el => el === document.activeElement));
      await page.click('.help-panel .panel-btn');
      check(`catalog ${lang}: Resume restores focus to Pause`, await page.$eval('.pause-btn', el => el === document.activeElement));
      await page.click('.pause-btn');
      await page.screenshot({ path: join(reports, `back_noodle-night_pause${lang === 'en' ? '' : '_' + lang}.png`) });
      for (const width of [375, 1440]) {
        await page.setViewport({ width, height: width === 375 ? 812 : 900 });
        await axe(`pause ${width}`);
      }
      // Delete the saved copy in click capture: only the link's synchronous save
      // can restore it before document bubble and native navigation.
      await linkCheck('.help-panel');
      const saved = await navigate('.help-panel', lang !== 'en', null, true);
      await title();
      check(`catalog ${lang}: saved pause exit offers Continue`, !!(await page.$('.continue-btn')));
      await linkCheck('.title-screen'); await navigate('.title-screen', true, saved.raw);
      await gate(); await linkCheck('.loading-screen'); await navigate('.loading-screen', true, saved.raw);
      await title(); await page.click('.continue-btn'); await page.click('.pause-btn');
      const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('noodle_night_run')).state);
      const prior = JSON.parse(saved.raw).state;
      check(`catalog ${lang}: exit snapshot restores bowl, score, lives, combo and customers`,
        ['bowl','coins','hearts','combo','bestCombo','served','rng','nextId','seatsOpen','selectedId'].every(k => JSON.stringify(restored[k]) === JSON.stringify(prior[k])) && restored.customers[0].id === prior.customers[0].id);
    } finally { await context.close(); }
  }
}
