import {check,axe,overflow,reports,sleep} from './browser-utils.mjs';
import {L,P} from './load-logic.mjs';

const labels={en:'Back to catalog','zh-tw':'返回目錄','zh-cn':'返回目录',ja:'カタログに戻る'};
const readSave=p=>p.evaluate(key=>localStorage.getItem(key),L.SAVE_KEY);
async function tabToLink(page){
 for(let i=0;i<12;i++){
  if(await page.evaluate(()=>document.activeElement.matches('a.catalog-link')))return true;
  await page.keyboard.press('Tab');
 }
 return false;
}
async function linkCheck(page,where,label,parent){
 const data=await page.$eval(`${where} .catalog-link`,(e,parent)=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return {href:e.getAttribute('href'),resolved:e.href===parent,text:e.textContent.trim(),height:r.height,
   fits:e.scrollWidth<=e.clientWidth+1&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
   guarded:s.userSelect==='none'&&s.webkitTapHighlightColor.replaceAll(' ','')==='rgba(0,0,0,0)'};
 },parent);
 const named=await page.$(`::-p-aria([name="${label}"][role="link"])`);
 check(`${where} ${label}: native parent link, accessible name, target size and fit`,data.href==='../'&&data.resolved&&data.text===label&&data.height>=48&&data.fits&&data.guarded&&!!named,JSON.stringify(data));
}
async function focusCheck(page,name){
 const focused=await tabToLink(page);
 const ring=await page.evaluate(()=>{
  const e=document.activeElement,s=getComputedStyle(e),rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
  const lum=v=>rgb(v).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  const outline=lum(s.outlineColor),background=lum(getComputedStyle(e.parentElement).backgroundColor==='rgba(0, 0, 0, 0)'?s.backgroundColor:getComputedStyle(e.parentElement).backgroundColor);
  return e.matches(':focus-visible')&&s.outlineStyle==='solid'&&parseFloat(s.outlineWidth)>=3&&(Math.max(outline,background)+.05)/(Math.min(outline,background)+.05)>=3;
 });
 check(`${name}: keyboard Tab and contrasting 3px focus ring`,focused&&ring);
}

export async function catalogLinks({browser,url}){
 for(const width of [375,1440])for(const [lang,label] of Object.entries(labels)){
  const ctx=await browser.createBrowserContext(),p=await ctx.newPage();
  try{
   await p.setViewport({width,height:width===375?812:900,hasTouch:false});
   const initial=L.createMatch(847,'ember','frost','lantern');initial.countdown=0;
   const saved=JSON.stringify({match:initial,mode:'cup',level:3,cupStep:2});
   const progress={...P.newProgress(),cupStep:2,wins:7,coach:true,unlocked:['ember','frost','gale']};
   await p.evaluateOnNewDocument((lang,saved,progress,saveKey,progressKey)=>{
    localStorage.setItem('stitch-arena.lang',lang);localStorage.setItem(saveKey,saved);localStorage.setItem(progressKey,JSON.stringify(progress));
    window.__catalogEvents=[];
    let fullscreen=false;
    Object.defineProperty(document,'fullscreenElement',{get:()=>fullscreen});
    window.__catalogFullscreen=()=>{fullscreen=true;};
    document.exitFullscreen=()=>{window.__catalogEvents.push('exit');fullscreen=false;return Promise.resolve();};
    screen.orientation.unlock=()=>window.__catalogEvents.push('unlock');
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===saveKey)window.__catalogEvents.push('snapshot');return set.call(this,k,v);};
    const suspend=AudioContext.prototype.suspend;AudioContext.prototype.suspend=function(){window.__catalogEvents.push('suspend');return suspend.call(this);};
    document.addEventListener('click',e=>{if(e.target.closest('a.catalog-link'))window.__catalogDefaultPrevented=e.defaultPrevented;});
   },lang,saved,progress,L.SAVE_KEY,P.PROGRESS_KEY);
   const gameUrl=url+'catalog-test/stitch-arena/',parent=new URL('../',gameUrl).href,requests=[];
   await p.setRequestInterception(true);
   p.on('request',r=>{
    if(r.isNavigationRequest()&&r.url()===parent){requests.push(r.url());void r.respond({status:204});}
    else if(r.url().startsWith(gameUrl))void r.continue({url:url+r.url().slice(gameUrl.length)});
    else void r.continue();
   });
   await p.goto(gameUrl);await p.waitForSelector('.btn--play',{timeout:60000});
   await linkCheck(p,'.title',label,parent);
   await p.focus('.btn--play');await focusCheck(p,`title ${lang} ${width}`);
   if(lang==='en')await axe(p,`catalog title ${width}`);
   if(width===1440&&lang==='zh-tw')await p.screenshot({path:`${reports}/back_stitch-arena_title.png`});
   let count=requests.length;await p.keyboard.press('Enter');await p.waitForFunction(()=>window.__catalogDefaultPrevented===false);await sleep(100);
   check(`title ${lang} ${width}: Enter follows ../ and preserves existing match`,requests.length===count+1&&await readSave(p)===saved&&p.url()===gameUrl);
   await p.click('.btn--play');await p.waitForSelector('[data-screen=menu]');
   await linkCheck(p,'.menu',label,parent);
   count=requests.length;await p.click('.menu .catalog-link');await sleep(100);
   check(`home ${lang} ${width}: click follows ../ and preserves progress/snapshot`,requests.length===count+1&&await readSave(p)===saved&&await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).wins===7,P.PROGRESS_KEY));
   // A 204 intentionally keeps this document alive after navigation; restore
   // visibility audio before checking the next independent departure.
   await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await sleep(100);
   await p.click('.menu-actions>.primary');await p.waitForSelector('[data-screen=play]');
   check(`play ${lang} ${width}: no catalog link in HUD`,await p.$$eval('[data-screen=play] .catalog-link',els=>els.length===0));
   await p.keyboard.press('d');await p.click('.toolbar button:last-child');await p.waitForSelector('[role=dialog]');
   await linkCheck(p,'.modal',label,parent);
   await focusCheck(p,`pause ${lang} ${width}`);
   await p.keyboard.press('Tab');const forward=await p.evaluate(()=>document.activeElement===document.querySelector('.modal button'));
   await p.keyboard.down('Shift');await p.keyboard.press('Tab');await p.keyboard.up('Shift');
   check(`pause ${lang} ${width}: focus wraps both ways through catalog link`,forward&&await p.evaluate(()=>document.activeElement.matches('a.catalog-link')));
   const problems=await p.evaluate(overflow);check(`pause ${lang} ${width}: translated dialog fits`,problems.length===0,problems.join(';'));
   if(lang==='en')await axe(p,`catalog pause ${width}`);
   if(width===1440&&lang==='zh-tw')await p.screenshot({path:`${reports}/back_stitch-arena_pause.png`});
   await p.keyboard.press('Escape');await sleep(30);
   check(`pause ${lang} ${width}: focus restored to pause trigger`,await p.evaluate(()=>document.activeElement===document.querySelector('.toolbar button:last-child')));
   await p.keyboard.press('Enter');await p.waitForSelector('[role=dialog]');
   // Remove any periodic save while paused: the click must synchronously write
   // the complete current match even if less than one save interval has elapsed.
   await p.evaluate(key=>{localStorage.removeItem(key);window.__catalogEvents=[];window.__catalogFullscreen();},L.SAVE_KEY);
   count=requests.length;
   if(lang==='en'){await focusCheck(p,`pause activation ${width}`);await p.keyboard.press('Enter');}
   else await p.click('.modal .catalog-link');
   await sleep(100);
   const raw=await readSave(p),v=JSON.parse(raw),events=await p.evaluate(()=>window.__catalogEvents);
   check(`pause ${lang} ${width}: synchronous unthrottled full Cup snapshot before navigation`,!!L.restore(JSON.stringify(v?.match))&&v.match.winner===null&&v.match.tick>initial.tick&&v.mode==='cup'&&v.level===3&&v.cupStep===2&&events.includes('snapshot'));
   check(`pause ${lang} ${width}: unlock, exit fullscreen, save, suspend audio; native ../ navigation`,requests.length===count+1&&events.indexOf('unlock')===0&&events.indexOf('exit')===1&&events.indexOf('snapshot')>1&&events.indexOf('suspend')>events.indexOf('snapshot')&&await p.evaluate(()=>window.__catalogDefaultPrevented===false),events.join(','));
   await p.evaluate(()=>dispatchEvent(new Event('pagehide')));
   check(`pause ${lang} ${width}: catalog save equals pagehide snapshot`,await readSave(p)===raw);
  }finally{await ctx.close();}
 }
 // A real finished production match must never create another snapshot from home.
 const ctx=await browser.createBrowserContext(),p=await ctx.newPage();
 try{
  const match=L.createMatch(19);match.countdown=0;match.fighters[1].stocks=1;match.fighters[1].x=2000;
  await p.evaluateOnNewDocument((key,match)=>localStorage.setItem(key,JSON.stringify({match,mode:'duel',level:1,cupStep:0})),L.SAVE_KEY,match);
  await p.goto(url);await p.waitForSelector('.btn--play',{timeout:60000});await p.click('.btn--play');await p.click('.menu-actions>.primary');await p.waitForSelector('[data-screen=result]');
  check('finished match clears snapshot',await readSave(p)===null);
  await p.click('.page-actions button:first-child');
  await p.setRequestInterception(true);p.on('request',r=>r.isNavigationRequest()?r.respond({status:204}):r.continue());
  await p.click('.menu .catalog-link');await sleep(100);
  check('catalog after finished match preserves win, never writes finished snapshot',await readSave(p)===null&&await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).wins===1,P.PROGRESS_KEY));
 }finally{await ctx.close();}
}
