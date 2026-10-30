import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

// Serve the built game at its real catalog depth, so resolving ../ is tested
// against a different path rather than the preview server's root.
export async function catalogChecks(browser, root, port, check, auditAxe) {
  const prefix = '/gamegen-prototypes/mahjong-deck/';
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path.slice(1);
    if (rel.includes('..')) { res.writeHead(400).end(); return; }
    try {
      const file = rel || 'index.html';
      const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.mp3':'audio/mpeg' };
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(join(root, 'dist', file)));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${port}${prefix}`;
  const parent = new URL('../', base).href;
  const context = await browser.createBrowserContext();
  const reports = join(root, '..', '_reports');
  mkdirSync(reports, { recursive:true });
  const viewports = [[1280,720],[1440,900],[1920,1080],[844,390],[667,375],[390,844],[360,640]];
  const labels = { en:'Back to catalog', 'zh-tw':'返回目錄', 'zh-cn':'返回目录', ja:'カタログに戻る' };
  const issues = [];
  try {
    for (const [lang, label] of Object.entries(labels)) {
      const page = await context.newPage();
      page.on('pageerror', err => issues.push(err.message));
      let navigation;
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (req.isNavigationRequest() && req.url() === parent) {
          // Read the save in the click event, before the browser requests ../.
          navigation = req.url();
          req.abort('aborted');
        } else req.continue();
      });
      await page.evaluateOnNewDocument(lang => {
        localStorage.setItem('mahjong-deck.lang', lang);
        localStorage.setItem('mahjong-deck.coach', '1');
      }, lang);
      const enter = async () => {
        await page.waitForSelector('.btn--enter');
        await page.click('.btn--enter');
        await page.waitForSelector('.title__content');
      };
      const tabToLink = async () => {
        for (let i=0; i<40; i++) {
          await page.keyboard.press('Tab');
          if (await page.evaluate(() => document.activeElement?.matches('.catalog-link'))) return true;
        }
        return false;
      };
      const assertLink = async (screen) => {
        const accessibility = await page.accessibility.snapshot({root:await page.$('.catalog-link')});
        const metrics = await page.$eval('.catalog-link', (a, label) => {
          const r=a.getBoundingClientRect(), s=getComputedStyle(a);
          return { href:a.getAttribute('href'), url:a.href, text:a.textContent.trim(),
            name:a.getAttribute('aria-label') ?? a.textContent.trim(),
            fits:a.scrollWidth<=a.clientWidth+1 && r.height>=48 && r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight,
            focus:a.matches(':focus-visible') && parseFloat(s.outlineWidth)>=3 && s.outlineStyle==='solid',
            contrast:(() => {
              const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
              const a=lum(s.outlineColor),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            })() };
        }, label);
        check(`catalog ${lang} ${screen}: relative URL, visible name, fit, 48px target and keyboard focus`,
          metrics.href==='../' && metrics.url===parent && metrics.text===label && metrics.name===label && accessibility?.role==='link' && accessibility.name===label && metrics.fits && metrics.focus && metrics.contrast>=3, JSON.stringify(metrics));
      };
      await page.setViewport({width:390,height:844});
      await page.goto(base, {waitUntil:'networkidle0'});
      await page.waitForSelector('.btn--enter');
      check(`catalog ${lang}: loading/start link is Tab reachable`, await tabToLink());
      await assertLink('loading');
      await enter();
      check(`catalog ${lang}: title link is Tab reachable`, await tabToLink());
      await assertLink('title');
      for (const width of [375,1440]) {
        await page.setViewport({width,height:width===375?812:900});
        await auditAxe(page, `catalog ${lang} title ${width}`);
      }
      await page.click('.btn--play');
      await page.waitForSelector('.game .tile');
      check(`catalog ${lang}: no catalog link in gameplay/HUD`, !await page.$('.catalog-link'));
      // Exercise a meaningful action, then deliberately remove its action-save.
      // Only the link's synchronous lifecycle flush can recreate this snapshot.
      await page.click('.tile[data-free="1"]');
      await page.waitForSelector('.tile--selected');
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mahjong-deck.run')));
      await page.click('.help-btn');
      await page.waitForSelector('dialog[open]');
      check(`catalog ${lang}: help link is Tab reachable`, await tabToLink());
      await assertLink('help');
      let trapped=true;
      for(let i=0;i<6;i++) {
        await page.keyboard.press('Tab');
        trapped &&= await page.evaluate(() => !!document.activeElement?.closest('dialog'));
      }
      check(`catalog ${lang}: Tab stays inside help`, trapped);
      await page.keyboard.down('Shift');
      trapped=true;
      for(let i=0;i<6;i++) {
        await page.keyboard.press('Tab');
        trapped &&= await page.evaluate(() => !!document.activeElement?.closest('dialog'));
      }
      await page.keyboard.up('Shift');
      check(`catalog ${lang}: Shift+Tab stays inside help`, trapped);
      const selected=before.state.selected;
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('h');
      check(`catalog ${lang}: help keys do not alter the run`, await page.evaluate(selected => document.querySelector('.tile--selected')?.dataset.tid===String(selected), selected));
      for (const [width,height] of viewports) {
        await page.setViewport({width,height});
        const fits=await page.$eval('dialog .catalog-link',a=>{const r=a.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth && a.scrollWidth<=a.clientWidth+1;});
        check(`catalog ${lang}: help link fits ${width}x${height}`,fits);
      }
      for (const width of [375,1440]) {
        await page.setViewport({width,height:width===375?812:900});
        await auditAxe(page, `catalog ${lang} help ${width}`);
      }
      if (lang==='en') {
        await page.setViewport({width:390,height:844});
        await page.waitForSelector('dialog[open] .catalog-link',{visible:true});
        await new Promise(resolve=>setTimeout(resolve,150));
        await page.screenshot({path:join(reports,'back_mahjong-deck_pause.png')});
      }
      await page.keyboard.press('Escape');
      check(`catalog ${lang}: Escape closes help and restores focus`, await page.evaluate(() => !document.querySelector('dialog[open]') && document.activeElement?.matches('.help-btn')));
      await page.click('.help-btn');
      await page.waitForSelector('dialog[open]');
      await page.evaluate(() => {
        window.__catalogSave = null;
        document.addEventListener('click', (event) => {
          window.__catalogSave = localStorage.getItem('mahjong-deck.run');
          window.__catalogDefaultPrevented = event.defaultPrevented;
        }, {once:true});
        localStorage.removeItem('mahjong-deck.run');
      });
      await tabToLink();
      if (lang==='en') await page.click('.catalog-link');
      else await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__catalogSave !== null);
      for(let i=0;i<20&&!navigation;i++) await new Promise(r=>setTimeout(r,20));
      const saved=await page.evaluate(() => JSON.parse(window.__catalogSave));
      check(`catalog ${lang}: ${lang==='en'?'click':'Enter'} synchronously flushes full run before parent navigation`,
        isDeepStrictEqual(saved,before) && navigation===parent && saved.state.selected===selected && !await page.evaluate(() => window.__catalogDefaultPrevented));
      await page.goto(base,{waitUntil:'networkidle0'});
      await enter();
      check(`catalog ${lang}: Continue remains available after catalog departure`, !!await page.$('.btn--continue'));
      // Saved-run title includes both primary buttons; test all 7 sizes/locales.
      for(const [width,height] of viewports) {
        await page.setViewport({width,height});
        const fits=await page.evaluate(() => {
          const nodes=[...document.querySelectorAll('.title__logo,.title__dealer,.title__name,.title__tagline,.title__content button,.title__content a')];
          const rects=nodes.map(e=>e.getBoundingClientRect());
          return nodes.every((e,i)=>{const r=rects[i];return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth+1;}) &&
            rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left+1||a.left>=b.right-1||a.bottom<=b.top+1||a.top>=b.bottom-1));
        });
        check(`catalog ${lang}: Continue title has no clipping/overlap ${width}x${height}`,fits);
      }
      if(lang==='en') {
        await page.setViewport({width:390,height:844});
        await page.waitForSelector('.title .catalog-link',{visible:true});
        await new Promise(resolve=>setTimeout(resolve,150));
        await page.screenshot({path:join(reports,'back_mahjong-deck_title.png')});
      }
      // Title departures must also synchronously preserve the resumable run.
      const run=await page.evaluate(() => localStorage.getItem('mahjong-deck.run'));
      navigation=null;
      await page.click('.catalog-link');
      for(let i=0;i<20&&!navigation;i++) await new Promise(r=>setTimeout(r,20));
      const afterTitle = await page.evaluate(() => JSON.parse(localStorage.getItem('mahjong-deck.run')));
      check(`catalog ${lang}: title departure preserves saved run and requests parent`,navigation===parent && isDeepStrictEqual(afterTitle,JSON.parse(run)));
      if(lang==='en') {
        await page.goto(base,{waitUntil:'networkidle0'});await enter();
        await page.click('.btn--continue');await page.waitForSelector('.game .tile');
        if(await page.$('.tile--selected')) await page.$eval('.tile--selected',e=>e.click());
        for(let i=0;i<5&&!await page.$('.panel--result');i++) {
          const pair=await page.$$eval('.tile[data-free="1"]',tiles=>{
            for(const a of tiles)for(const b of tiles)if(a.dataset.type!==b.dataset.type)return [a.dataset.tid,b.dataset.tid];
          });
          if(!pair)break;
          for(const id of pair) await page.$eval(`[data-tid="${id}"]`,e=>e.click());
        }
        await page.waitForSelector('.panel--result');
        await page.focus('.help-btn');await page.keyboard.press('Enter');
        await page.waitForSelector('dialog[open]');
        navigation=null;
        await page.evaluate(() => {
          window.__finishedSave='pending';
          document.addEventListener('click',()=>{window.__finishedSave=localStorage.getItem('mahjong-deck.run');},{once:true});
        });
        await page.click('.catalog-link');
        for(let i=0;i<20&&!navigation;i++) await new Promise(r=>setTimeout(r,20));
        check('catalog: leaving a finished run keeps its snapshot cleared and best score saved',navigation===parent && await page.evaluate(()=>window.__finishedSave===null && localStorage.getItem('mahjong-deck.run')===null && localStorage.getItem('mahjong-deck.best')!==null));
      }
      await page.close();
    }
    check('catalog: zero page errors',issues.length===0,issues.join(' | '));
  } finally {
    await context.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
