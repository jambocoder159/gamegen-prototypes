import { mkdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { axeSource } from './axe-source.mjs';

const reports = fileURLToPath(new URL('../../_reports/', import.meta.url));

async function linkCheck(page, label, check, name) {
  const selector = '.catalog-link';
  const data = await page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    return { href: el.getAttribute('href'), resolved: el.href, parent: new URL('../', location.href).href,
      text: el.textContent.trim(), fits: el.scrollWidth <= el.clientWidth + 1 &&
        r.height >= 48 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
  });
  check(`${name}: relative catalog destination and translated text fit`,
    data.href === '../' && data.resolved === data.parent && data.text === label && data.fits, JSON.stringify(data));
  const client = await page.createCDPSession();
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { nodes } = await client.send('Accessibility.getPartialAXTree', { nodeId });
  check(`${name}: accessible link name equals visible text`, nodes.some(n => n.role?.value === 'link' && n.name?.value === label));
  await client.detach();
  let focused = false;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    focused = await page.$eval(selector, el => el === document.activeElement);
    if (focused) break;
  }
  const ring = await page.$eval(selector, el => {
    const s = getComputedStyle(el);
    const luminance = c => {
      const [r,g,b] = c.match(/[\d.]+/g).slice(0,3).map(Number).map(v => {
        const n=v/255; return n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4;
      });
      return .2126*r+.7152*g+.0722*b;
    };
    const a=luminance(s.outlineColor), b=luminance(s.backgroundColor);
    return el.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 3 &&
      (Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 3;
  });
  check(`${name}: Tab reaches a visible ≥3px, ≥3:1 focus ring`, focused && ring);
}

// Return 204 to the native parent-directory request: navigation is exercised,
// while the browser keeps the game document available for assertions.
async function navigate(page, keyboard, expectedRun, check, name) {
  const destination = new URL('../', page.url()).href;
  await page.evaluate(() => {
    window.__catalogClick = null;
    document.addEventListener('click', e => {
      if (e.target.closest('.catalog-link')) window.__catalogClick = {
        prevented: e.defaultPrevented, run: localStorage.getItem('mochi.run'), best: localStorage.getItem('mochi.best')
      };
    }, { once: true });
    localStorage.removeItem('mochi.run');
  });
  await page.setRequestInterception(true);
  let handler;
  const requested = new Promise(resolve => {
    handler = req => {
      if (req.isNavigationRequest() && req.url() === destination) {
        resolve(req.url());
        void req.respond({status:204});
      } else void req.continue();
    };
    page.on('request', handler);
  });
  const response = page.waitForResponse(res => res.url() === destination, { timeout:5000 });
  if (keyboard) await page.keyboard.press('Enter');
  else await page.click('.catalog-link');
  await response;
  page.off('request', handler);
  await page.setRequestInterception(false);
  const clicked = await page.evaluate(() => window.__catalogClick);
  check(`${name}: native ${keyboard ? 'Enter' : 'click'} requests ../ without preventDefault`,
    await requested === destination && clicked && !clicked.prevented);
  check(`${name}: snapshot is saved synchronously before navigation`, clicked &&
    isDeepStrictEqual(JSON.parse(clicked.run), JSON.parse(expectedRun)));
  if (expectedRun) check(`${name}: best score is retained`, Number(clicked.best) >= JSON.parse(expectedRun).best);
}

export async function catalogChecks(browser, base, check) {
  mkdirSync(reports, {recursive:true});
  for (const [lang,label] of [['en','Back to catalog'],['zh-tw','返回目錄'],['zh-cn','返回目录'],['ja','カタログに戻る']]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    try {
      await page.setViewport({width:360,height:640});
      await page.goto(base);
      await page.waitForSelector('.btn--play');
      await page.evaluate(code => localStorage.setItem('mochi.lang',code), lang);
      await page.reload(); await page.waitForSelector('.catalog-link');
      await linkCheck(page,label,check,`catalog title ${lang}`);
      if (lang === 'en') {
        await page.setViewport({width:390,height:844});
        await page.screenshot({path:join(reports,'back_mochi-merge_title.png')});
      }
      await navigate(page,true,null,check,`catalog fresh title ${lang}`);
      await page.click('.btn--play'); await page.waitForSelector('.game');
      for (const key of ['ArrowLeft','ArrowDown','ArrowRight','ArrowUp']) await page.keyboard.press(key);
      const saved = await page.evaluate(() => localStorage.getItem('mochi.run'));
      check(`catalog ${lang}: active run exists and HUD has no catalog link`,
        saved && JSON.parse(saved).state.moves > 0 && await page.$('.game .catalog-link') === null);
      await page.focus('.help-btn'); await page.keyboard.press('Enter');
      await page.waitForSelector('.panel--help');
      await linkCheck(page,label,check,`catalog help ${lang}`);
      await page.keyboard.press('Tab');
      const wrapped = await page.$eval('.panel--help button',el=>el===document.activeElement);
      await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
      check(`catalog help ${lang}: Tab and Shift+Tab wrap inside dialog`, wrapped &&
        await page.$eval('.catalog-link',el=>el===document.activeElement));
      await page.keyboard.press('ArrowLeft');
      check(`catalog help ${lang}: dialog blocks board input`,saved === await page.evaluate(()=>localStorage.getItem('mochi.run')));
      await page.keyboard.press('Escape');
      check(`catalog help ${lang}: Escape restores focus to ?`, await page.$('.panel--help') === null &&
        await page.$eval('.help-btn',el=>el===document.activeElement));
      await page.keyboard.press('Enter'); await page.waitForSelector('.panel--help');
      if (lang === 'en') {
        for (const width of [375,1440]) {
          await page.setViewport({width,height:width === 375 ? 812 : 900});
          await page.evaluate(axeSource);
          const issues = await page.evaluate(async () => (await window.axe.run(document)).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
          check(`axe catalog help ${width}: zero violations`, issues.length === 0, JSON.stringify(issues));
        }
        await page.screenshot({path:join(reports,'back_mochi-merge_pause.png')});
      }
      await page.setViewport({width:360,height:640});
      // A pointer activation must flush even if the per-move save was lost.
      await navigate(page,false,saved,check,`catalog active help ${lang}`);
      await page.keyboard.press('Escape');
      await page.reload(); await page.waitForSelector('.btn--new');
      await linkCheck(page,label,check,`catalog Continue title ${lang}`);
      await navigate(page,true,saved,check,`catalog saved title ${lang}`);
    } finally { await context.close(); }
  }
}
