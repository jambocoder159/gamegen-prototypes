// Real browser coverage for gameplay, reloads, four languages, layout and axe.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qa = join(root, 'qa');
const reports = join(root, '..', '_reports');
for (const path of [qa, reports]) mkdirSync(path, {recursive:true});
const PORT = Number(process.env.PORT) || 4223;
const BASE = `http://localhost:${PORT}/noodle-night/`;
const results = [];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function check(name, ok, detail='') {
  results.push({name,ok}); console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' — '+detail:''}`);
}
const axeSource = readFileSync('/workspace/deploy/node_modules/axe-core/axe.min.js','utf8');
if (!process.env.SKIP_BUILD) execSync('npm run build',{cwd:root,stdio:'inherit'});
const server=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--port',String(PORT),'--strictPort','--base','/noodle-night/'],{cwd:root,stdio:'pipe'});
let serverError='';server.stderr.on('data',d=>serverError+=d);
let browser;
async function screenshot(page,name) {
  await page.screenshot({path:join(qa,`${name}.png`)});
  await page.screenshot({path:join(reports,`fix_noodle-night_${name}.png`)});
}
async function title(page) {
  await page.goto(BASE); await page.waitForSelector('.enter-btn'); await page.click('.enter-btn'); await page.waitForSelector('.title-screen');
}
async function axe(page,name) {
  await page.evaluate(axeSource);
  const violations=await page.evaluate(async()=> (await window.axe.run()).violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(',')}`));
  check(`axe ${name}: zero violations`,violations.length===0,violations.join(' | '));
}
async function orderKeys(page) {
  await page.waitForSelector('.customer.selected .bubble-content',{timeout:4000});
  return page.$$eval('.customer.selected .bubble-item img',imgs=>imgs.map(img=>['egg','scallion','pork','fishcake','chili','bokchoy'].findIndex(k=>img.src.includes(`icon_${k}.png`))+1));
}
async function serveSelected(page) {
  const keys=await orderKeys(page); await page.keyboard.press('c');
  for(const k of keys) await page.keyboard.press(String(k));
  await page.click('.serve-btn');
}
const run = page=>page.evaluate(()=>JSON.parse(localStorage.getItem('noodle_night_run'))?.state);
const coins = page=>page.$eval('.hud-coins-num',el=>Number(el.textContent));
async function fit(page,selectors='button, .hud, .coach, .bowl-feedback, .customer, .bowl, .toppings') {
  return page.evaluate(selectors=>{
    const bad=[];
    for(const el of document.querySelectorAll(selectors)) {
      if(el.closest('[aria-hidden="true"]'))continue;
      const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
      if(r.left < -1 || r.top < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1)bad.push(el.className+' clipped');
      if(el.tagName==='BUTTON'&&(r.width<47.9||r.height<47.9))bad.push(el.className+' <48px');
    }
    for(const el of document.querySelectorAll('.plate-label,.hud-combo,.hud-coins-num,.coach li,.panel h2,.panel p,.step-guide li')) {
      if(el.scrollWidth>el.clientWidth+1)bad.push(el.className+' text overflow');
    }
    const coach=document.querySelector('.coach, .bowl-feedback')?.getBoundingClientRect();
    if(coach) for(const customer of document.querySelectorAll('.customer')) {
      if(customer.getBoundingClientRect().top<coach.bottom-1)bad.push('coach overlaps customer');
    }
    const tray=document.querySelector('.toppings')?.getBoundingClientRect(),serve=document.querySelector('.serve-btn')?.getBoundingClientRect();
    if(tray&&serve&&(Math.abs(serve.top-tray.bottom)>12 || serve.left<tray.left || serve.right>tray.right+1))bad.push('Serve not adjacent to tray');
    return bad;
  },selectors);
}
let fatal=false;
try {
  for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('preview exited '+serverError);try{if((await fetch(BASE)).ok)break;}catch{}await wait(200);}
  browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const page=await browser.newPage(); await page.setViewport({width:375,height:812});
  const consoleIssues=[],failedReq=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleIssues.push(m.text());});
  page.on('pageerror',e=>consoleIssues.push(e.message));
  page.on('requestfailed',r=>failedReq.push(r.url()));
  await title(page);check('loading gate and assets work from /noodle-night/ subpath',true);
  await screenshot(page,'title');
  for(const w of [375,1440]){await page.setViewport({width:w,height:w===375?812:900});await axe(page,`title ${w}`);}
  const demo=await page.$eval('.demo-field',el=>el.innerHTML);await wait(950);
  check('title demo is running',demo!==await page.$eval('.demo-field',el=>el.innerHTML));
  check('title shows saved best score',await page.$eval('.title-best',el=>el.textContent.includes('0')));
  await page.setViewport({width:360,height:640});await page.click('.play-btn');await page.waitForSelector('.coach');
  check('C1: first run shows nonblocking icon coach',await page.$eval('.coach li',el=>el.dataset.step)==='0'&&!!await page.$('.coach img'));
  check('N1: first customer has 48 seconds', (await run(page)).customers[0].patienceMax===48);
  await screenshot(page,'onboarding');
  check('C1: coach keeps customers and controls clear at 360×640',(await fit(page)).length===0,(await fit(page)).join(' | '));
  await page.click('.customer.selected .customer-btn');
  check('C1: selecting customer advances coach',await page.$eval('.coach li',el=>el.dataset.step)==='1');
  const keys=await orderKeys(page);await page.keyboard.press(String(keys[0]));
  check('C1: adding topping advances to Serve',await page.$eval('.coach li',el=>el.dataset.step)==='2');
  for(const k of keys.slice(1))await page.keyboard.press(String(k));
  await page.click('.serve-btn');await page.waitForFunction(()=>!document.querySelector('.coach'));
  check('C1: correct Serve completes coach',true);
  await orderKeys(page);
  const hearts=await page.$eval('.hud-hearts',el=>el.getAttribute('aria-label'));
  await page.click('.serve-btn');
  check('N2: empty Serve gives gentle visible feedback without losing a life',!!await page.$('.bowl-feedback')&&hearts===await page.$eval('.hud-hearts',el=>el.getAttribute('aria-label')));
  check('N2: feedback does not overlap customers or controls',(await fit(page)).length===0,(await fit(page)).join(' | '));
  await screenshot(page,'empty_bowl');
  // Save a partial bowl and compare all fields across a real document reload.
  await page.keyboard.press('1');await page.keyboard.press('2');await page.click('.pause-btn');
  const before=await run(page);await page.reload();await page.waitForSelector('.enter-btn');await page.click('.enter-btn');
  check('C3: saved run offers Continue and New game',!!await page.$('.continue-btn')&&await page.$eval('.play-btn',el=>el.textContent.includes('New game')));
  await page.click('.continue-btn');await page.waitForSelector('.game-screen');await page.click('.pause-btn');
  const after=await run(page);
  check('C3: reload restores bowl, score, hearts, combo, customers, RNG and elapsed',
    ['bowl','coins','hearts','combo','bestCombo','served','rng','nextId','seatsOpen','selectedId'].every(k=>JSON.stringify(before[k])===JSON.stringify(after[k])) &&
    before.customers[0].id===after.customers[0].id&&Math.abs(before.customers[0].patience-after.customers[0].patience)<0.25&&Math.abs(before.elapsed-after.elapsed)<0.25);
  check('C1: coach stays dismissed after reload',!await page.$('.coach'));
  for(const w of [375,1440]){await page.setViewport({width:w,height:w===375?812:900});await axe(page,`help ${w}`);}
  check('N6: help has three illustrated steps and concise keyboard reference',await page.$$eval('.help-panel .step-guide li',els=>els.length)===3&&await page.$$eval('.help-panel .step-art img',els=>els.length)>=3&&!await page.$('.help-panel p:not(.keyboard-help)'));
  const frozen=(await run(page)).elapsed;await page.keyboard.press('1');await wait(250);
  check('pause freezes gameplay and ignores topping shortcuts',(await run(page)).elapsed===frozen);
  await screenshot(page,'help');await page.click('.help-panel .panel-btn');
  await page.click('.help-btn');check('C1: ? reopens coach',!!await page.$('.coach'));
  await page.click('.coach-skip');check('C1: coach is skippable',!await page.$('.coach'));
  // Build a real 19-serve streak, reading orders from their public icons.
  while((await run(page)).combo<19){await serveSelected(page);}
  const incompleteKeys=await orderKeys(page);
  await page.keyboard.press('c');await page.keyboard.press(String(incompleteKeys[0]));
  const incompleteBefore=await run(page);await page.click('.serve-btn');const incompleteAfter=await run(page);
  check('N2: incomplete Serve preserves toppings, lives and ×10 streak',incompleteKeys.length>=2&&incompleteAfter.hearts===incompleteBefore.hearts&&incompleteAfter.combo===19&&JSON.stringify(incompleteAfter.bowl)===JSON.stringify(incompleteBefore.bowl)&&!!await page.$('.bowl-feedback'));
  await page.keyboard.press('c');
  check('score increases on correct serves',(await coins(page))>0);
  check('N7: HUD displays ×10 combo cap',await page.$eval('.hud-combo-mult',el=>el.textContent.trim())==='×10');
  await screenshot(page,'high_combo');
  await page.evaluate(()=>window.__noReload='kept');
  const originalCoins=await coins(page),langs=new Set(),overflow=[];
  for(const [w,h,dpr] of [[375,812,1],[360,640,1],[390,844,3],[844,390,1],[667,375,1],[1280,720,1],[1440,900,1],[1920,1080,1],[466,678,1],[678,466,1],[626,890,1],[890,626,1],[445,626,1]]) {
    await page.setViewport({width:w,height:h,deviceScaleFactor:dpr});
    for(let i=0;i<4;i++) {
      await page.click('.lang-btn');langs.add(await page.evaluate(()=>document.documentElement.lang));
      const bad=await fit(page);if(bad.length)overflow.push(`${w}×${h} ${i}: ${bad.join(',')}`);
      const label=await page.$eval('.serve-btn',el=>({text:el.textContent.trim(),aria:el.getAttribute('aria-label')}));
      if(label.text!==label.aria)overflow.push('Serve aria mismatch');
      if(w===360){
        await page.click('.pause-btn');
        const instruction=await page.$eval('.help-panel .step-guide li:last-child',el=>el.textContent);
        if(!instruction.includes(label.text))overflow.push('Serve instruction mismatch');
        const helpProblems=await fit(page,'.help-panel button, .help-panel');
        if(helpProblems.length)overflow.push(...helpProblems);
        await page.click('.help-panel .panel-btn');
      }
    }
    if(w===390)await screenshot(page,'portrait');if(w===844)await screenshot(page,'landscape');if(w===1280)await screenshot(page,'wide');if(w===626)await screenshot(page,'square');
  }
  check('all 4 languages applied without overflow',langs.size===4&&overflow.length===0,overflow.slice(0,8).join(' | '));
  check('N3/N4: Serve label/aria agree and button remains adjacent in every language/layout',overflow.length===0);
  check('resize keeps document and game state',await page.evaluate(()=>window.__noReload==='kept')&&await coins(page)===originalCoins);
  for(const w of [375,1440]) {
    await page.setViewport({width:w,height:w===375?812:900});
    await axe(page,`play ${w}`);
    const sizes=await page.evaluate(()=>({fonts:[...document.querySelectorAll('.hud-combo-label,.hud-combo-num,.hud-coins-num,.hud-combo-mult')].map(el=>parseFloat(getComputedStyle(el).fontSize)),hearts:[...document.querySelectorAll('.heart')].every(el=>el.getBoundingClientRect().height>=28)}));
    check(`C5: HUD ≥18px, numbers ≥20px, hearts ≥28px at ${w}`,sizes.fonts.every(v=>v>=18)&&sizes.fonts.filter((_,i)=>i!==1).every(v=>v>=20)&&sizes.hearts);
  }
  // Extra topping is a wrong order; empty/subset bowls were separately checked.
  await orderKeys(page);for(let i=0;i<3;i++){
    await page.keyboard.press('c');const current=await orderKeys(page);const wrong=[1,2,3,4,5,6].find(k=>!current.includes(k));
    await page.keyboard.press(String(wrong));await page.click('.serve-btn');
  }
  await page.waitForSelector('.result-panel');check('game over / result screen reachable',true);
  check('N5: result clears customers, bowl, toppings and queue',!await page.$('.play-field')&&!await page.$('.customer,.bowl,.bowl-topping'));
  check('C3: game over clears saved run',await page.evaluate(()=>localStorage.getItem('noodle_night_run')===null));
  check('N8: result shows persisted best and new-best badge',!!await page.$('.new-best')&&await page.evaluate(()=>Number(localStorage.getItem('noodle_night_best'))>0));
  const best=await page.evaluate(()=>localStorage.getItem('noodle_night_best'));
  for(const w of [375,1440]){await page.setViewport({width:w,height:w===375?812:900});await axe(page,`result ${w}`);}
  await screenshot(page,'result');await title(page);
  check('N8: best survives reload and appears on title',await page.$eval('.title-best',el=>el.textContent.includes(String(localStorage.getItem('noodle_night_best'))))&&await page.evaluate(()=>localStorage.getItem('noodle_night_best'))===best);
  await page.click('.play-btn');await page.keyboard.press('3');await title(page);await page.click('.play-btn');
  check('C3: New game clears the previous bowl/score', (await run(page)).bowl.length===0&&(await run(page)).coins===0);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.keyboard.press('1');
  check('reduced motion disables topping animation',await page.$eval('.bowl-topping',el=>getComputedStyle(el).animationName)==='none');
  check('no console errors/warnings',consoleIssues.length===0,consoleIssues.slice(0,4).join(' | '));
  check('no unexpected failed requests',failedReq.length===0,failedReq.slice(0,4).join(' | '));
  await page.close();
  // C2: browser language mapping and saved-choice precedence, with isolated storage.
  for(const [languages,saved,expected] of [
    [['zh-TW'],null,'zh-Hant-TW'],[['zh-HK'],null,'zh-Hant-TW'],[['zh-MO'],null,'zh-Hant-TW'],[['zh-Hant-US'],null,'zh-Hant-TW'],
    [['zh-CN'],null,'zh-Hans-CN'],[['zh-SG'],null,'zh-Hans-CN'],[['zh-Hans'],null,'zh-Hans-CN'],[['zh'],null,'zh-Hans-CN'],
    [['ja-JP'],null,'ja'],[['en-US'],null,'en'],[['fr-FR'],null,'en'],[['fr','ja'],null,'ja'],[['zh-TW'],'ja','ja'],[['ja'],'bad','ja']
  ]) {
    const context=await browser.createBrowserContext(),p=await context.newPage();
    await p.evaluateOnNewDocument((languages,saved)=>{Object.defineProperty(navigator,'languages',{get:()=>languages});if(saved)localStorage.setItem('noodle_night_lang',saved);},languages,saved);
    await p.goto(BASE);await p.waitForSelector('.enter-btn');
    check(`C2: ${languages.join(',')} saved=${saved}`,await p.evaluate(()=>document.documentElement.lang)===expected);
    await context.close();
  }
  for(const raw of ['{bad',JSON.stringify({version:2,state:{}}),'x'.repeat(17000)]){
    const p=await browser.newPage();await p.evaluateOnNewDocument(raw=>localStorage.setItem('noodle_night_run',raw),raw);
    await title(p);check('C3: corrupt/oversize/version-mismatched run resets safely',!await p.$('.continue-btn')&&await p.evaluate(()=>localStorage.getItem('noodle_night_run')===null));await p.close();
  }
  const fallback=await browser.newPage();await fallback.setRequestInterception(true);
  fallback.on('request',r=>r.url().includes('icon_egg.png')?r.abort():r.continue());
  await title(fallback);await fallback.click('.play-btn');await fallback.waitForSelector('.game-screen');
  check('game still starts with a blocked image',true);await fallback.close();
} catch(err){console.error(err);fatal=true;} finally {if(browser)await browser.close();server.kill('SIGTERM');}
const failures=results.filter(r=>!r.ok);
console.log(`\n${results.length-failures.length}/${results.length} checks passed.`);
if(fatal||failures.length)process.exit(1);
console.log('ALL CHECKS PASSED');
