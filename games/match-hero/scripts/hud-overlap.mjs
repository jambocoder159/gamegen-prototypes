import {writeFileSync} from 'node:fs';
import {check,reports,sleep} from './browser-utils.mjs';
import {logic as L} from './load-logic.mjs';

const viewports=[[390,844],[360,640],[844,390],[667,375],[1280,720],[1440,900],[1920,1080]];

// Read transformed DOM boxes, including every visible descendant of each HUD group.
// Reduced motion and paused combat make these idle measurements reproducible.
function geometry(){
 const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
 const inside=(a,b,tolerance=0)=>a.x>=b.x-tolerance&&a.y>=b.y-tolerance&&a.right<=b.right+tolerance&&a.bottom<=b.bottom+tolerance;
 const intersects=(a,b)=>Math.min(a.right,b.right)>Math.max(a.x,b.x)&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y);
 const stage=box(document.querySelector('.battle__stage'));
 const sprites=[...document.querySelectorAll('.battle__stage > .hero,.battle__stage > .enemy')].map(e=>({name:e.className,src:e.getAttribute('src'),rect:box(e)}));
 const hud=[...document.querySelectorAll('[data-hud],[data-hud] *')].filter(visible);
 const collisions=hud.flatMap(e=>sprites.filter(s=>intersects(box(e),s.rect)).map(s=>({hud:e.className||e.tagName,hudRect:box(e),sprite:s})));
 const escaped=sprites.filter(s=>!inside(s.rect,stage,1));
 const viewport={x:0,y:0,right:innerWidth,bottom:innerHeight};
 const board=box(document.querySelector('.board'));
 const stats=box(document.querySelector('.stats')), skills=box(document.querySelector('.skills'));
 const statsFit=[...document.querySelectorAll('.hero-stats,.match-stats')].every(e=>inside(box(e),stats,1)) && !intersects(stats,skills);
 return{statsFit,stage,sprites,hudCount:hud.length,collisions,escaped,board,boardFits:inside(board,viewport),noScroll:document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight&&document.body.scrollWidth<=innerWidth&&scrollX===0&&scrollY===0,landscape:document.querySelector('.game').classList.contains('game--landscape'),height:innerHeight};
}

export async function verifyHud(browser,url){
 const context=await browser.createBrowserContext();
 const page=await context.newPage();
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.evaluateOnNewDocument(()=>{localStorage.setItem('match-hero.lang','en');localStorage.setItem('match-hero.coached','1');});
 const measurements=[];
 try{
  for(const[width,height]of viewports){
   await page.setViewport({width,height});
   // Floor 3 is still the slime/bat/skeleton tier. Ghost and golem need later
   // waves, reached through the same validated save interface as normal play.
   for(const scenario of[{floor:1},{floor:3},{floor:5},{floor:10},{floor:6,wave:2,art:'enemy_ghost'},{floor:11,wave:2,art:'enemy_golem'}]){
    const{floor,wave,art}=scenario;
    await page.goto(url+(wave?'':`?floor=${floor}`));
    await page.waitForSelector('.btn--play');
    if(wave){
     const run=L.newRun(L.seeded(9),floor);run.wave=wave;
     await page.evaluate((key,value)=>localStorage.setItem(key,value),L.SAVE_KEY,L.serialize(run));
     await page.reload();await page.waitForSelector('.btn--play');
    }
    await page.click('.btn--play');await page.waitForSelector('.battle__stage > img.enemy');
    await page.click('button[aria-label="Pause"]');
    await page.waitForFunction(()=>[...document.querySelectorAll('.battle__stage > img')].every(e=>e.complete&&e.naturalWidth>0));
    await sleep(60);
    const g=await page.evaluate(geometry),name=`HUD ${width}x${height} floor ${floor}${wave?` wave ${wave}`:''}`;
    measurements.push({width,height,floor,wave,...g});
    check(`${name}: all HUD boxes separate (${g.hudCount})`,g.collisions.length===0,JSON.stringify(g.collisions));
    check(`${name}: both sprites inside stage`,g.sprites.length===2&&g.escaped.length===0,JSON.stringify(g.escaped));
    check(`${name}: statistics contents fit without touching skills`,g.statsFit);
    check(`${name}: board inside viewport`,g.boardFits);
    check(`${name}: no document scroll`,g.noScroll);
    check(`${name}: stage has height${g.landscape?' ≥45% viewport':''}`,g.stage.height>0&&(!g.landscape||g.stage.height>=height*.45),`${g.stage.height.toFixed(1)}px`);
    const expected=art||(floor===5?'boss_dragon':floor===10?'boss_demon':'enemy_slime');
    check(`${name}: expected sprite ${expected}`,g.sprites.some(s=>s.src?.includes(expected)));
    if(floor===1||([5,10].includes(floor)&&((width===390&&height===844)||height<=520))){
     await page.waitForSelector('.floor-toast',{hidden:true});
     const suffix=floor===1?'':`floor${floor}_`;
     await page.screenshot({path:`${reports}/after_hud_match-hero_${suffix}${width}x${height}.png`});
    }
   }
  }
  writeFileSync(`${reports}/match-hero_hud-measurements.json`,JSON.stringify(measurements,null,2));
 }finally{await context.close();}
}
