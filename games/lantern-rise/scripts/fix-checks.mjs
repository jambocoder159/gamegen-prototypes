import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameSim, CorridorBot, FIXED_DT, CONFIG } from '../src/game/logic.ts';
import { hudCeilingWorldY } from '../src/config/layout.ts';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const reports = '/workspace/gamegen-games/_reports';
const axeSource = readFileSync('/workspace/deploy/node_modules/axe-core/axe.min.js', 'utf8');

export async function fixChecks(browser, base, check) {
  mkdirSync(reports, { recursive: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('console', msg => { if (['error','warning'].includes(msg.type())) errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => requests.push(req.url()));
  page.on('response', res => { if (res.status() >= 400) requests.push(`${res.status()} ${res.url()}`); });
  const enter = async () => {
    await page.waitForSelector('.lr-enter');
    await page.click('.lr-enter');
    await page.waitForSelector('.lr-title');
  };
  const axe = async (name) => {
    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] },
    })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`));
    check(`axe: ${name}`, violations.length === 0, violations.join(' | '));
  };
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'zh-Hant-HK', 'ja-JP'] });
    });
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(base);
    await enter();
    check('C2 browser language follows first supported navigator.languages entry', await page.$eval('html', el => el.lang) === 'zh-TW');
    await page.click('.lr-corner-tr .lr-iconbtn:last-child');
    const selected = await page.$eval('html', el => el.lang);
    await page.reload(); await enter();
    check('C2 saved explicit language overrides browser', await page.$eval('html', el => el.lang) === selected);
    await page.evaluate(() => localStorage.setItem('lantern-rise.lang', 'en'));
    await page.reload(); await enter();
    for (const width of [375,1440]) {
      await page.setViewport({width, height: width === 375 ? 812 : 900});
      await axe(`title ${width}`);
    }
    await page.setViewport({width:375,height:812});
    await page.click('.lr-play');
    await page.waitForSelector('.lr-countdown');
    await page.waitForFunction(() => document.querySelector('.lr-lantern')?.style.transform);
    const startTransform = await page.$eval('.lr-lantern', e => e.style.transform);
    const countdowns = [];
    for (const number of [3,2,1]) {
      await page.waitForFunction(n=>document.querySelector('.lr-countdown strong')?.textContent === String(n),{},number);
      countdowns.push(await page.$eval('.lr-countdown strong',e=>Number(e.textContent)));
    }
    check('L1 readable 3-2-1 countdown before physics starts', countdowns.join(',') === '3,2,1' &&
      startTransform === await page.$eval('.lr-lantern',e=>e.style.transform), countdowns.join(','));
    await page.waitForFunction(() => !document.querySelector('.lr-countdown'));
    check('C1 first-run coach shown, non-modal and live', await page.$eval('.lr-coach', el =>
      !!el.querySelector('[aria-live="polite"]') && !el.hasAttribute('aria-modal')));
    await page.focus('.lr-playfield');
    await page.keyboard.down('Space'); await sleep(200);
    check('C1 hold automatically advances coach', await page.$eval('.lr-coach-message', e=>e.textContent.includes('Release')));
    await page.keyboard.up('Space'); await sleep(100);
    check('C1 release automatically advances coach to spark collection', await page.$eval('.lr-coach-message',e=>e.textContent.includes('star sparks')));
    await page.screenshot({path:join(reports,'fix_lantern-rise_onboarding.png')});
    await page.keyboard.down('Space');
    await axe('onboarding 375');
    await page.setViewport({width:1440,height:900}); await axe('onboarding 1440');
    await page.setViewport({width:375,height:812}); await page.keyboard.up('Space');
    await page.click('.lr-coach-skip');
    check('C1 skip stores first-run flag', await page.evaluate(()=>localStorage.getItem('lantern-rise.coach') === '1'));
    await page.click('.lr-help-button');
    check('C1 help reopens the coach', !!await page.$('.lr-coach'));
    await page.click('.lr-coach-skip');
    await page.focus('.lr-playfield'); await page.keyboard.down('Space');
    await sleep(1400);
    await page.keyboard.up('Space');
    await page.keyboard.press('p');
    await page.waitForSelector('.lr-pause');
    const before = await page.$eval('.lr-pill-value',e=>Number(e.textContent));
    // pagehide writes the most recent snapshot, including fractional seconds.
    await page.reload(); await enter();
    check('C3 reload offers Continue and New game', !!await page.$('.lr-continue') && await page.$eval('.lr-play', e=>e.textContent === 'New game'));
    const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('lantern-rise.run')));
    await page.click('.lr-continue'); await page.waitForSelector('.lr-pause');
    await page.waitForFunction(d=>Number(document.querySelector('.lr-pill-value')?.textContent) === d,{},before);
    await sleep(60);
    check('C3 reload restores distance and oil safely paused', await page.$eval('.lr-pill-value', e=>Number(e.textContent)) === before &&
      Number(await page.$eval('[role="progressbar"]',e=>e.getAttribute('aria-valuenow'))) === Math.floor(saved.state.lantern.fuel));
    check('C1 coach stays dismissed after reload', !await page.$('.lr-coach'));
    await axe('pause 375');
    await page.setViewport({width:1440,height:900}); await axe('pause 1440');
    await page.click('.lr-pause button');
    await page.focus('.lr-playfield'); await page.keyboard.down('Space');
    await axe('play 1440');
    await page.setViewport({width:375,height:812}); await axe('play 375');
    await page.keyboard.up('Space');
    await page.waitForSelector('.lr-result', {timeout:10000});
    check('C3 game over clears saved run', await page.evaluate(()=>localStorage.getItem('lantern-rise.run') === null));
    await axe('result 375');
    await page.setViewport({width:1440,height:900}); await axe('result 1440');

    // Persisted, validated fixture exercises a low-oil transition using real input.
    await page.reload(); await enter();
    const sim = new GameSim(303);
    sim.setView(640*375/812,.28,hudCeilingWorldY('portrait',375,812)); sim.reset(303);
    const fixture = JSON.parse(JSON.stringify(sim.snapshot()));
    Object.assign(fixture.state,{readyRemaining:0,time:8,scrollX:1250,nextSpawnX:4000,sparks:[],flames:[],crows:[],storms:[]});
    Object.assign(fixture.state.lantern,{fuel:25.5,y:280,vy:0});
    await page.evaluate(f=>localStorage.setItem('lantern-rise.run',JSON.stringify(f)),fixture);
    await page.reload(); await enter(); await page.click('.lr-continue');
    await page.click('.lr-pause button');
    await page.evaluate(() => {
      window.__sounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) { window.__sounds.push(this.buffer?.duration); return start.apply(this,args); };
    });
    await page.focus('.lr-playfield'); await page.keyboard.down('Space'); await sleep(350);
    await page.keyboard.up('Space'); await page.keyboard.press('p');
    check('L3 low oil has warning icon, text and aria-live', await page.$eval('.lr-oil-warning',e=>
      e.getAttribute('aria-live') === 'polite' && e.textContent.includes('Low oil') && !!e.querySelector('[aria-hidden]')));
    const sounds = await page.evaluate(async () => {
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(await (await fetch('./common/audio/sfx_hit.mp3')).arrayBuffer());
      const expected = buffer.duration;
      await ctx.close();
      return { cues: window.__sounds.filter(d=>Math.abs(d-expected)<0.01).length, durations: window.__sounds };
    });
    check('L3 low-oil sound cue plays once on threshold crossing', sounds.cues === 1, JSON.stringify(sounds));
    check('L3 low-oil bar pulses colour', await page.$eval('.lr-meter-fill',e=>getComputedStyle(e).animationName === 'oil-warning'));
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await sleep(100);
    check('L1/L3 reduced-motion countdown and warning do not animate', await page.$eval('.lr-meter-fill',e=>getComputedStyle(e).animationName === 'none'));
    await page.click('.lr-pause button');
    await page.setViewport({width:375,height:812});
    await page.focus('.lr-playfield'); await page.keyboard.down('Space');
    await page.screenshot({path:join(reports,'fix_lantern-rise_oil_warning.png')});
    await page.keyboard.up('Space'); await page.keyboard.press('p');
    // All HUD labels and controls, in all languages and narrow/landscape layouts.
    await page.reload(); await enter(); await page.click('.lr-play');
    await page.focus('.lr-playfield'); await page.keyboard.down('Space');
    let issues=[];
    for (const [w,h] of [[360,640],[375,812],[667,375],[844,390],[1440,900]]) {
      await page.setViewport({width:w,height:h});
      for (const lang of ['en','zh-TW','zh-CN','ja']) {
        await page.evaluate(l=>localStorage.setItem('lantern-rise.lang',l),lang);
        // Live switch using the actual globe, preserving the current run.
        for (let i=0; i<4 && await page.$eval('html',e=>e.lang) !== lang; i++) await page.click('.lr-corner-tr .lr-iconbtn:last-child');
        check(`C5 live HUD language ${lang} at ${w}x${h}`, await page.$eval('html',e=>e.lang) === lang);
        await sleep(30);
        issues.push(...await page.evaluate(()=>{
          const bad=[];
          for(const e of document.querySelectorAll('.lr-iconbtn')) {
            const r=e.getBoundingClientRect(); if(r.width<48 || r.height<48 || r.left<0 || r.right>innerWidth) bad.push('button bounds');
          }
          for(const e of document.querySelectorAll('.lr-pill-label,.lr-pill-unit,.lr-oil-label,.lr-oil-warning')) {
            if(parseFloat(getComputedStyle(e).fontSize)<18) bad.push('small label');
          }
          for(const e of document.querySelectorAll('.lr-pill-value,.lr-oil-label strong')) if(parseFloat(getComputedStyle(e).fontSize)<20) bad.push('small number');
          for(const e of document.querySelectorAll('.lr-pill-content,.lr-oil-warning')) if(e.scrollWidth>e.clientWidth+1) bad.push('HUD overflow');
          if(document.querySelector('.lr-meter-channel').getBoundingClientRect().height<18) bad.push('thin oil channel');
          return bad;
        }));
      }
    }
    check('C5/L5 HUD ≥18px, numbers ≥20px, controls ≥48px, oil fill ≥18px; all languages fit', issues.length===0, issues.slice(0,5).join(','));
    await page.keyboard.up('Space'); await page.focus('.lr-playfield'); await page.keyboard.press('p');
    // Dismiss overlay for screenshots, then freeze again without losing the run.
    await page.evaluate(()=>localStorage.setItem('lantern-rise.lang','en'));
    await page.reload(); await enter(); await page.click('.lr-continue');
    for (const [w,h,name] of [[360,640,'portrait'],[844,390,'landscape']]) {
      await page.setViewport({width:w,height:h}); await page.click('.lr-pause button');
      await page.focus('.lr-playfield'); await page.keyboard.down('Space');
      await page.screenshot({path:join(reports,`fix_lantern-rise_${name}.png`)});
      await page.keyboard.up('Space'); await page.keyboard.press('p');
    }
    // New game must clear the old identity; no first-run coach on the next run.
    await page.reload(); await enter(); await page.click('.lr-play');
    await page.waitForSelector('.lr-countdown');
    await page.waitForFunction(()=>localStorage.getItem('lantern-rise.run') !== null);
    check('L1 reduced-motion countdown stays static', await page.$eval('.lr-countdown',e=>getComputedStyle(e).animationName === 'none'));
    const fresh = await page.evaluate(()=>JSON.parse(localStorage.getItem('lantern-rise.run')));
    check('C3 New game replaces old run with a fresh countdown', fresh.state.time===0 && fresh.state.scrollX===0 && fresh.state.lantern.fuel===100);
    check('C1 subsequent runs do not show onboarding', !await page.$('.lr-coach'));
    // Bad saves reset safely rather than exposing Continue.
    await page.reload(); await enter();
    for (const value of ['{', JSON.stringify({version:999}), 'x'.repeat(150001)]) {
      await page.evaluate(v=>localStorage.setItem('lantern-rise.run',v),value);
      await page.reload(); await enter();
      if(await page.$('.lr-continue')) issues.push('bad save continued');
    }
    check('C3 malformed/versioned/oversized save safely resets', !issues.includes('bad save continued'));

    let samples=0, badRange=false;
    for (const [w,h,mode] of [[360,640,'portrait'],[844,390,'wide'],[1440,900,'wide']]) {
      const model=new GameSim(913); model.setView(640*w/h,.28,hudCeilingWorldY(mode,w,h)); model.reset(913);
      const bot=new CorridorBot();
      for(let i=0;i<180/FIXED_DT;i++) {
        model.step(FIXED_DT,bot.decide(model,FIXED_DT));
        if(i%120===0) for(const s of model.sparks) { samples++; if(s.y<model.ceilingY+70 || s.y>CONFIG.sparkMaxY) badRange=true; }
      }
    }
    check('L4 headless simulation: sparks stay above lower play area and below HUD', !badRange && samples>1000,`${samples} samples`);
    check('fix scenarios have no console errors/warnings', errors.length === 0, errors.slice(0,3).join(' | '));
    check('fix scenarios have no failed requests', requests.length === 0, requests.slice(0,3).join(' | '));
  } finally { await context.close(); }
}
