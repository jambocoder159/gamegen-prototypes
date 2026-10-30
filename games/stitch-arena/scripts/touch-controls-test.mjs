import {sleep,check,overflow,axe} from './browser-utils.mjs';
const point=(p,selector,id=1)=>p.$eval(selector,(e,id)=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id};},id);
export async function touchControls({browser,menu,duel,open,snap,shot,geometry,faults}){
 console.log('\nTouch controls');
 const ctx=await browser.createBrowserContext(),p=await ctx.newPage();
 const errors=[];p.on('console',m=>{if(['error','warn','warning'].includes(m.type()))errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>errors.push(r.url()));
 // Fullscreen stubs do not change Chrome's viewport or consume user activation.
 await p.evaluateOnNewDocument(()=>{
  window.__displayCalls=[];let active=false;
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>active?document.documentElement:null});
  HTMLElement.prototype.requestFullscreen=async function(options){window.__displayCalls.push({api:'fullscreen',gesture:navigator.userActivation.isActive,options});active=true;document.dispatchEvent(new Event('fullscreenchange'));};
  document.exitFullscreen=async()=>{active=false;document.dispatchEvent(new Event('fullscreenchange'));};
  Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async value=>{window.__displayCalls.push({api:'lock',gesture:navigator.userActivation.isActive,value});}});
  screen.orientation.unlock=()=>{};
 });
 await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await open(p,'?debug=input');await menu(p);await sleep(80);
 check('touch Play requests fullscreen and landscape once in gesture',await p.evaluate(()=>{const c=window.__displayCalls;return c.length===2&&c.every(c=>c.gesture)&&c[0].api==='fullscreen'&&c[0].options.navigationUI==='hide'&&c[1].value==='landscape';}),JSON.stringify(await p.evaluate(()=>window.__displayCalls)));
 await p.evaluate(()=>window.__displayCalls=[]);await duel(p);await sleep(100);
 check('Start requests landscape from gesture without repeating active fullscreen',await p.evaluate(()=>window.__displayCalls.length===1&&window.__displayCalls[0].api==='lock'&&window.__displayCalls[0].gesture),JSON.stringify(await p.evaluate(()=>window.__displayCalls)));
 for(const [w,h]of[[844,390],[667,375],[932,430],[568,320],[1024,768]]){
  await p.setViewport({width:w,height:h,hasTouch:true,isMobile:true});await sleep(180);
  const g=await p.evaluate(geometry),issues=await p.evaluate(overflow);
  const controls=await p.evaluate(()=>{
   const selectors=['.joystick-zone',...['up','punch','spell','hook'].map(k=>`[data-input="${k}"]`)];const rects=selectors.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};});
   const problems=[];for(const e of document.querySelectorAll('.plate,.play-top button,.timer')){const b=e.getBoundingClientRect();if(b.bottom>64)problems.push('HUD exceeds top strip: '+e.className);for(const r of rects)if(r.x<b.right&&r.right>b.left&&r.y<b.bottom&&r.bottom>b.top)problems.push('HUD overlaps control: '+e.className);}for(let i=0;i<rects.length;i++){const r=rects[i],min=i===0?140:64;if(r.w<min||r.h<min)problems.push('small '+selectors[i]);if(i&&innerWidth===844&&(r.w<72||r.h<72))problems.push('under preferred 72');if(r.x<8||r.y<8||r.right>innerWidth-8||r.bottom>innerHeight-8)problems.push('unsafe '+selectors[i]);for(let j=0;j<i;j++){const b=rects[j];if(r.x<b.right&&r.right>b.x&&r.y<b.bottom&&r.bottom>b.y)problems.push('overlap '+i+'/'+j);}}
   const r=document.querySelector('canvas').getBoundingClientRect(),fs=window.__gg.match.fighters,live=fs.filter(f=>f.respawn<=0&&f.stocks>0),f=live.length?live:fs,ar=r.width/r.height,cw=Math.min(1600,Math.max(ar<1.3?680:900,Math.max(...f.map(f=>f.x))-Math.min(...f.map(f=>f.x))+290,(Math.max(...f.map(f=>f.y))-Math.min(...f.map(f=>f.y))+340)*ar));
   return {problems,stageHeight:r.height,ratio:142/(cw/ar),joystick:document.querySelectorAll('.joystick-zone').length,buttons:document.querySelectorAll('.touch-actions button').length};
  });
  check(`touch geometry ${w}x${h}`,g.issues.length===0&&issues.length===0&&controls.problems.length===0&&controls.joystick===1&&controls.buttons===4,JSON.stringify({...controls,issues:[...g.issues,...issues]}));
  check(`touch stage and fighter size ${w}x${h}`,controls.stageHeight>=h*.45&&controls.ratio>=.14,`${controls.stageHeight}px; fighter ${(controls.ratio*100).toFixed(1)}%`);
 }
 await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await p.waitForFunction(()=>window.__gg.match.countdown===0);await sleep(100);
 const cdp=await p.createCDPSession(),send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 let origin=await point(p,'.joystick-zone'),stick={...origin};let before=await snap(p);
 await send('touchStart',[stick]);stick.x+=36;await send('touchMove',[stick]);await sleep(180);let after=await snap(p);
 check('joystick drag right moves fighter right',after.input.right&&!after.input.left&&after.match.fighters[0].x>before.match.fighters[0].x+5);
 stick.x=origin.x-36;before=await snap(p);await send('touchMove',[stick]);await sleep(300);after=await snap(p);
 check('joystick drag left moves fighter left',after.input.left&&!after.input.right&&after.match.fighters[0].x<before.match.fighters[0].x-5);
 stick={...origin,y:origin.y-36};await send('touchMove',[stick]);await sleep(50);check('joystick up aims without jumping',await p.evaluate(()=>window.__gg.input.aimUp&&!window.__gg.input.up),JSON.stringify((await snap(p)).input));
 stick={...origin,y:origin.y+36};await send('touchMove',[stick]);await sleep(50);check('joystick down drops and aims down',await p.evaluate(()=>window.__gg.input.down&&window.__gg.input.aimDown));
 await send('touchEnd',[]);await sleep(50);check('joystick release clears all axes',await p.evaluate(()=>!['left','right','down','aimUp','aimDown'].some(k=>window.__gg.input[k])));
 await send('touchStart',[await point(p,'[data-input=punch]')]);await sleep(750);await send('touchEnd',[]);check('touch long press does not select',await p.evaluate(()=>!getSelection().toString()));
 // Fresh ordinary match, no simulation mutation; keep movement short to stay on platform.
 await p.click('button[aria-label="Pause"]');await p.click('.dialog-actions button:nth-child(2)');await p.waitForFunction(()=>window.__gg.match.countdown===0);await sleep(80);
 origin=await point(p,'.joystick-zone');stick={...origin};const punch=await point(p,'[data-input=punch]',2),jump=await point(p,'[data-input=up]',3);
 await send('touchStart',[stick]);stick.x+=24;await send('touchMove',[stick]);await send('touchStart',[stick,punch]);await sleep(45);
 check('second touch Punch registers while joystick stays held',await p.waitForFunction(()=>window.__gg.input.right&&window.__gg.input.punch&&window.__gg.match.fighters[0].punchCd>0,{timeout:800}).then(()=>true,()=>false),JSON.stringify({input:(await snap(p)).input,fighter:(await snap(p)).match.fighters[0]}));
 await send('touchStart',[stick,punch,jump]);await sleep(50);
 check('third touch Jump preserves joystick and Punch holds',await p.evaluate(()=>window.__gg.input.right&&window.__gg.input.punch&&window.__gg.input.up&&!window.__gg.input.aimUp&&window.__gg.match.fighters[0].jumps>0));
 await send('touchEnd',[punch,jump]);check('lifting action touches preserves joystick',await p.evaluate(()=>window.__gg.input.right&&!window.__gg.input.punch&&!window.__gg.input.up));await send('touchEnd',[]);await sleep(30);check('multi-touch release clears held inputs',await p.evaluate(()=>!Object.values(window.__gg.input).some(Boolean)));
 origin=await point(p,'.joystick-zone');stick={...origin};await send('touchStart',[stick]);stick.x+=30;await send('touchMove',[stick]);await send('touchStart',[stick,punch,jump]);await send('touchCancel',[]);await sleep(30);check('pointer cancellation clears joystick and action holds',await p.evaluate(()=>!Object.values(window.__gg.input).some(Boolean)));
 for(const field of['punch','spell','hook']){
  await p.waitForFunction(field=>window.__gg.match.fighters[0][field+'Cd']===0,{},field);
  await p.touchscreen.tap(...Object.values(await point(p,`[data-input=${field}]`)).slice(0,2));await sleep(45);
  const value=await p.$eval(`[data-input=${field}]`,e=>({text:e.querySelector('small').textContent,name:e.getAttribute('aria-label'),offset:+e.querySelector('circle').getAttribute('stroke-dashoffset')}));
  // UI refresh is throttled to 100ms; wait for its visible cooldown.
  await p.waitForFunction(field=>/\d/.test(document.querySelector(`[data-input=${field}] small`).textContent),{},field);
  check(`${field} cooldown has visible seconds, accessible name and ring`,await p.$eval(`[data-input=${field}]`,e=>e.getAttribute('aria-label').includes(e.querySelector('small').textContent)&&+e.querySelector('circle').getAttribute('stroke-dashoffset')<100),JSON.stringify(value));
  await p.waitForFunction(field=>document.querySelector(`[data-input=${field}] small`).textContent==='Ready',{},field);
  check(`${field} cooldown returns to Ready`,true);
 }
 // Required action captures, with a held joystick and a cooling spell at each size.
 for(const [w,h]of[[844,390],[667,375],[932,430]]){
  await p.setViewport({width:w,height:h,hasTouch:true,isMobile:true});await sleep(150);await p.waitForFunction(()=>window.__gg.match.fighters[0].spellCd===0);origin=await point(p,'.joystick-zone');stick={...origin};const spell=await point(p,'[data-input=spell]',2);await send('touchStart',[stick]);stick.x+=28;await send('touchMove',[stick]);await send('touchStart',[stick,spell]);await send('touchEnd',[spell]);await sleep(120);await shot(p,`touch_${w}x${h}`);await send('touchEnd',[]);
 }
 await p.click('button[aria-label="How to play"]');check('help documents keyboard and touch controls',await p.$eval('.modal',e=>e.textContent.includes('A/D')&&e.textContent.includes('joystick')));await p.click('.modal>button');await sleep(100);await shot(p,'touch_coach');await axe(p,'touch play 932x430');
 await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await sleep(150);await axe(p,'touch play 844x390');
 await p.click('button[aria-label="Pause"]');await axe(p,'touch pause');await p.keyboard.press('Escape');
 await p.evaluate(()=>window.__touchMarker='preserved');await p.setViewport({width:390,height:844,hasTouch:true,isMobile:true});await p.waitForSelector('.rotate-overlay');await sleep(150);const frozen=await snap(p);await sleep(350);check('portrait rotation overlay pauses simulation',!!await p.$('[role=alertdialog]')&&JSON.stringify((await snap(p)).match)===JSON.stringify(frozen.match));await shot(p,'rotate_overlay');await axe(p,'rotate overlay');
 for(let i=0;i<4;i++){
  const lang=await p.$eval('html',e=>e.lang);
  check(`rotate ${lang} translated dialog fits portrait`,await p.evaluate(()=>[document.querySelector('#rotate-title'),document.querySelector('#rotate-description')].every(e=>e.textContent.length>0&&e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().bottom<=innerHeight)));
  await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await p.waitForSelector('.rotate-overlay',{hidden:true});await p.click('.toolbar button:nth-child(3)');await p.setViewport({width:390,height:844,hasTouch:true,isMobile:true});await p.waitForSelector('.rotate-overlay');await sleep(80);
 }
 await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await p.waitForSelector('.rotate-overlay',{hidden:true});await sleep(180);check('rotation resumes same match and preserves window state',await p.evaluate(tick=>window.__touchMarker==='preserved'&&window.__gg.match.tick>tick&&window.__gg.match.fighters[0].char==='ember',frozen.match.tick));
 // Actual live language switches validate controls and coach labels, not only dictionaries.
 for(let i=0;i<4;i++){const lang=await p.$eval('html',e=>e.lang);for(const [w,h]of[[844,390],[667,375],[568,320]]){await p.setViewport({width:w,height:h,hasTouch:true,isMobile:true});await sleep(80);check(`touch live labels fit ${lang} ${w}x${h}`,(await p.evaluate(overflow)).length===0&&await p.$$eval('.plate,.play-top button,.timer',es=>es.every(e=>e.getBoundingClientRect().bottom<=64)));}await p.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await sleep(80);await p.click('.toolbar button:nth-child(3)');await sleep(100);}
 await p.click('.fullscreen-toggle');check('touch fullscreen toggle exits fullscreen',await p.evaluate(()=>!document.fullscreenElement));await p.click('.fullscreen-toggle');check('touch fullscreen toggle enters fullscreen',await p.evaluate(()=>!!document.fullscreenElement));
 await p.click('button[aria-label="Pause"]');await p.click('.dialog-actions button:last-of-type');check('return to menu releases fullscreen',await p.evaluate(()=>!document.fullscreenElement));
 check('touch application has no console errors or failed requests',errors.length===0,errors.join(';'));faults.push(...errors);await cdp.detach();await ctx.close();
 // APIs may be absent, denied, or WebKit-only; all are silent and gameplay remains available.
 for(const mode of['missing','rejecting','webkit']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.setViewport({width:844,height:390,hasTouch:true,isMobile:true});await page.evaluateOnNewDocument(mode=>{
   window.__webkitCalls=0;Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{value:mode==='rejecting'?()=>Promise.reject(new Error('Denied')):undefined,configurable:true});Object.defineProperty(screen.orientation,'lock',{value:mode==='rejecting'?()=>Promise.reject(new Error('Denied')):undefined,configurable:true});if(mode==='webkit')HTMLElement.prototype.webkitRequestFullscreen=async()=>{window.__webkitCalls++;};
  },mode);await open(page,'?debug=input');await menu(page);await duel(page);await sleep(200);check(`fullscreen ${mode} is silent and match starts`,errors.length===0&&!!await page.$('.joystick-zone')&&(mode!=='webkit'||await page.evaluate(()=>window.__webkitCalls>0)),errors.join(';'));await context.close();
 }
 const desktop=await browser.newPage();await desktop.setViewport({width:390,height:844,hasTouch:false,isMobile:false});await open(desktop,'?debug=input');await menu(desktop);await duel(desktop);await sleep(150);check('fine-pointer desktop portrait never shows rotate overlay',!await desktop.$('.rotate-overlay'));await desktop.close();
 const hybrid=await browser.newPage();await hybrid.setViewport({width:390,height:844,hasTouch:true});await hybrid.evaluateOnNewDocument(()=>{const original=window.matchMedia.bind(window);window.matchMedia=q=>{const m=original(q);if(q==='(pointer: fine)')return{...m,matches:true};if(q==='(pointer: coarse)')return{...m,matches:false};return m;};});await open(hybrid,'?debug=input');await menu(hybrid);await duel(hybrid);check('fine-pointer touch laptop keeps desktop controls in portrait',!await hybrid.$('.rotate-overlay')&&await hybrid.$eval('.joystick-zone',e=>getComputedStyle(e).display==='none'));await hybrid.close();
}
