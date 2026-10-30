import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { GameSim } from '../src/game/logic.ts';
import { axeSource } from './axe-source.mjs';

const reports = join(import.meta.dirname, '..', '..', '_reports');
const sizes = [[360,640],[375,812],[390,844],[667,375],[844,390],[1280,720],[1440,900],[1920,1080]];
const labels = { en: 'Back to catalog', 'zh-TW': '返回目錄', 'zh-CN': '返回目录', ja: 'カタログに戻る' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function tabToLink(page) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await page.$eval('.lr-catalog', e => e === document.activeElement)) return true;
  }
  return false;
}

function linkProblems(label, parent) {
  const links = document.querySelectorAll('.lr-catalog');
  if (links.length !== 1) return [`expected one link, found ${links.length}`];
  const e = links[0], r = e.getBoundingClientRect();
  const problems = [];
  if (e.tagName !== 'A' || e.getAttribute('href') !== '../' || e.href !== parent) problems.push('relative URL');
  if (e.textContent.trim() !== label || e.hasAttribute('aria-label')) problems.push('visible name');
  if (r.height < 48 || r.left < 7 || r.top < 7 || r.right > innerWidth-7 || r.bottom > innerHeight-7) problems.push('bounds/focus clearance');
  const range = document.createRange(); range.selectNodeContents(e);
  const text = range.getBoundingClientRect();
  if (e.scrollWidth > e.clientWidth+1 || text.left < r.left || text.right > r.right || text.bottom > r.bottom) problems.push('text overflow');
  for (const other of document.querySelectorAll('h1, h2, .lr-logo, .lr-tagline, .lr-help, button')) {
    const b = other.getBoundingClientRect();
    if (r.left < b.right-1 && r.right > b.left+1 && r.top < b.bottom-1 && r.bottom > b.top+1) problems.push(`overlap ${other.className}`);
  }
  return problems;
}

async function focusCheck(page, check, name) {
  const reached = await tabToLink(page);
  const ring = await page.$eval('.lr-catalog', e => {
    const s = getComputedStyle(e);
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(n => n/255).map(n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4);
      return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
    };
    const a = luminance(s.outlineColor), b = luminance(s.backgroundColor);
    return e.matches(':focus-visible') && s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 3 && (Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 3;
  });
  check(`catalog: ${name} reachable by Tab with ≥3px, ≥3:1 focus ring`, reached && ring);
}

export async function catalogChecks(browser, base, check) {
  mkdirSync(reports, {recursive:true});
  const context = await browser.createBrowserContext();
  const parent = new URL('../', base).href;
  const fixture = new GameSim(77).snapshot();
  const page = await context.newPage();
  const errors = [], failedRequests = [];
  const interceptedCatalog = new WeakSet();
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));
  // Chrome reports a cancelled document load for the deliberate 204 responses.
  page.on('requestfailed', request => { if (!interceptedCatalog.has(request)) failedRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) failedRequests.push(response.url()); });
  try {
    await page.evaluateOnNewDocument(() => {
      const Original = window.AudioContext;
      window.__catalogContexts = [];
      window.AudioContext = class extends Original {
        constructor(...args) { super(...args); window.__catalogContexts.push(this); }
      };
    });
    // Exercise the real menus, including Continue, in every language and size.
    for (const [lang, label] of Object.entries(labels)) {
      await page.goto(base);
      await page.evaluate((lang, fixture) => {
        localStorage.setItem('lantern-rise.lang', lang);
        localStorage.setItem('lantern-rise.run', JSON.stringify(fixture));
        localStorage.setItem('lantern-rise.coach', '1');
      }, lang, fixture);
      await page.reload();
      await page.waitForSelector('.lr-enter');
      for (const screen of ['gate', 'title', 'pause']) {
        if (screen === 'title') { await page.click('.lr-enter'); await page.waitForSelector('.lr-title'); }
        if (screen === 'pause') { await page.click('.lr-continue'); await page.waitForSelector('.lr-pause'); }
        const namedLink = await page.$(`::-p-aria([name="${label}"][role="link"])`);
        check(`catalog: ${screen} ${lang} accessible name equals visible text`, !!namedLink);
        await namedLink?.dispose();
        for (const [width, height] of sizes) {
          await page.setViewport({width, height});
          await sleep(35);
          const problems = await page.evaluate(linkProblems, label, parent);
          check(`catalog: ${screen} ${lang} ${width}x${height} URL, target size and fit`, !problems.length, problems.join(', '));
          if (width === 360) await focusCheck(page, check, `${screen} ${lang}`);
          if (lang === 'en' && [375,1440].includes(width)) {
            await page.evaluate(axeSource);
            const violations = await page.evaluate(async () => (await window.axe.run(document, {
              runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']},
            })).violations.map(v => v.id));
            check(`catalog: axe ${screen} ${width}: zero violations`, !violations.length, violations.join(', '));
          }
          if (lang === 'en' && screen === 'title' && width === 1280) await page.screenshot({path:join(reports,'back_lantern-rise_title.png')});
          if (lang === 'en' && screen === 'pause' && width === 375) await page.screenshot({path:join(reports,'back_lantern-rise_pause.png')});
        }
      }
      // The link participates in the modal Tab loop; Resume returns focus to Pause.
      await page.click('.lr-pause button');
      check(`catalog: ${lang} absent from in-play HUD`, !await page.$('.lr-catalog'));
      await page.click('.lr-glyphbtn');
      await page.waitForSelector('.lr-pause');
      const resumeFocused = await page.$eval('.lr-pause button', e => e === document.activeElement);
      await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
      const reverseWrapped = await page.$eval('.lr-catalog', e => e === document.activeElement);
      await page.keyboard.press('Tab');
      const forwardWrapped = await page.$eval('.lr-pause button', e => e === document.activeElement);
      await page.keyboard.press('Tab');
      const linkFocused = await page.$eval('.lr-catalog', e => e === document.activeElement);
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.lr-pause'));
      const restored = await page.$eval('.lr-glyphbtn', e => e === document.activeElement);
      check(`catalog: ${lang} modal focus entry, Tab/Shift+Tab wrap and restore`, resumeFocused && reverseWrapped && forwardWrapped && linkFocused && restored);
    }

    // A 204 catalog response keeps the original document open. Inspect storage at
    // request time, before any pagehide can save and mask a missing click handler.
    for (const screen of ['gate','title','pause']) {
      for (const keyboard of [false,true]) {
        await page.goto(base);
        await page.evaluate(fixture => {
          localStorage.setItem('lantern-rise.lang','en');
          localStorage.setItem('lantern-rise.run',JSON.stringify(fixture));
        }, fixture);
        await page.reload(); await page.waitForSelector('.lr-enter');
        if (screen !== 'gate') { await page.click('.lr-enter'); await page.waitForSelector('.lr-title'); }
        if (screen === 'pause') {
          // Countdown advances without changing simulation time: the one-second
          // autosave cannot update it, so leaving must bypass that throttle.
          await page.click('.lr-play');
          await page.waitForFunction(() => document.querySelector('.lr-countdown strong')?.textContent === '2');
          await page.click('.lr-glyphbtn'); await page.waitForSelector('.lr-pause');
          await page.evaluate(() => localStorage.removeItem('lantern-rise.run'));
        }
        await page.evaluate(() => {
          window.__catalogWrites = [];
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key,value) {
            if (key === 'lantern-rise.run') window.__catalogWrites.push(JSON.parse(value));
            return set.call(this,key,value);
          };
          window.__catalogSuspended = false;
          const suspend = AudioContext.prototype.suspend;
          AudioContext.prototype.suspend = function() { window.__catalogSuspended = true; return suspend.call(this); };
          document.addEventListener('click', event => {
            if (!event.target.closest('.lr-catalog')) return;
            window.__catalogEvidence = {
              writes: window.__catalogWrites,
              audioStopped: window.__catalogSuspended || window.__catalogContexts.every(ctx => ctx.state !== 'running'),
              prevented: event.defaultPrevented,
              saved: JSON.parse(localStorage.getItem('lantern-rise.run')),
            };
          });
        });
        let resolveRequest;
        const requested = new Promise(resolve => { resolveRequest = resolve; });
        await page.setRequestInterception(true);
        const intercept = async request => {
          if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
            if (request.url() === parent) interceptedCatalog.add(request);
            await request.respond({status:204});
            resolveRequest(request.url());
          } else await request.continue();
        };
        page.on('request',intercept);
        if (keyboard) { await tabToLink(page); await page.keyboard.press('Enter'); }
        else await page.click('.lr-catalog');
        let timer;
        const url = await Promise.race([requested,new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('catalog navigation not requested')),5000); })]);
        clearTimeout(timer);
        const evidence = await page.evaluate(() => window.__catalogEvidence);
        check(`catalog: ${screen} ${keyboard?'Enter':'click'} requests parent with native navigation`, url === parent && evidence.prevented === false);
        const saved = evidence.saved;
        const valid = saved && GameSim.restore(saved) && evidence.writes.length === 1;
        const matches = screen === 'pause' ? saved?.state.time === 0 && saved.state.readyRemaining > 0 && saved.state.readyRemaining <= 2 : JSON.stringify(saved) === JSON.stringify(fixture);
        check(`catalog: ${screen} ${keyboard?'Enter':'click'} saves synchronously before request and suspends audio`, valid && matches && evidence.audioStopped);
        page.off('request',intercept); await page.setRequestInterception(false);
      }
    }

    // Also preserve a progressed run, including RNG/entities, and clear a finished one.
    const progressed = new GameSim(78); progressed.readyRemaining = 0;
    for (let i=0;i<80;i++) progressed.step(1/120,i%2===0);
    await page.goto(base);
    await page.evaluate(snapshot => localStorage.setItem('lantern-rise.run',JSON.stringify(snapshot)),progressed.snapshot());
    await page.reload(); await page.waitForSelector('.lr-enter'); await page.click('.lr-enter'); await page.click('.lr-continue');
    await page.waitForSelector('.lr-pause');
    await page.evaluate(() => localStorage.removeItem('lantern-rise.run'));
    // Observe and cancel only the browser's navigation in this separate snapshot
    // check; the native-navigation cases above prove the handler never cancels it.
    await page.evaluate(() => document.querySelector('.lr-catalog').addEventListener('click',event => event.preventDefault()));
    await page.click('.lr-catalog');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-rise.run')));
    const expected = progressed.snapshot();
    check('catalog: progressed pause snapshot preserves time, fuel, distance, RNG and entities',
      saved && saved.state.time === expected.state.time && saved.state.scrollX === expected.state.scrollX &&
      saved.state.lantern.fuel === expected.state.lantern.fuel && saved.rngState === expected.rngState &&
      ['sparks','flames','crows','storms'].every(key => JSON.stringify(saved.state[key]) === JSON.stringify(expected.state[key])));
    await page.reload(); await page.waitForSelector('.lr-enter'); await page.click('.lr-enter'); await page.click('.lr-play');
    await page.waitForSelector('.lr-result',{timeout:15000});
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    check('catalog: finished run is never snapshotted, no result/HUD link',
      await page.evaluate(() => localStorage.getItem('lantern-rise.run') === null && !document.querySelector('.lr-catalog')));
    check('catalog: no console errors/warnings or failed requests', !errors.length && !failedRequests.length, [...errors,...failedRequests].slice(0,3).join(' | '));
  } finally { await context.close(); }
}
