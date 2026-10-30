import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const reports = '/workspace/gamegen-games/_reports';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const selectionConfig = {
  "game": "tap-garden",
  "gate": ".btn--enter",
  "play": ".btn--play",
  "root": ".garden",
  "main": ".garden .pot",
  "elements": ".garden__board, .garden .plot, .garden .pot, .garden .pill__value, .garden button",
  "text": ".garden .pill__value",
  "reading": ".coach p"
};

// A fresh context keeps gesture QA independent of the gameplay/save tests.
export async function selectionChecks(browser, base, check, phase = 'after', axePath = '/workspace/deploy/node_modules/axe-core/axe.min.js') {
  mkdirSync(reports, { recursive: true });
  const c = selectionConfig;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const evidence = { game: c.game, phase, gestures: [] };
  const assert = (name, ok, detail = '') => {
    if (phase === 'after') check(`selection: ${name}`, ok, ok ? '' : detail);
  };
  const selection = () => page.evaluate(() => {
    const s = getSelection();
    return { text: s.toString(), rangeCount: s.rangeCount, collapsed: s.isCollapsed,
      rangesCollapsed: Array.from({length:s.rangeCount}, (_,i) => s.getRangeAt(i).collapsed).every(Boolean) };
  });
  const record = async name => {
    const value = await selection();
    evidence.gestures.push({ name, ...value });
    assert(`${name} leaves no selected text or expanded range`, !value.text && value.collapsed && value.rangesCollapsed, JSON.stringify(value));
  };
  const point = async selector => page.$eval(selector, el => {
    const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  });
  try {
    await page.setViewport({width:375,height:812,hasTouch:true});
    await page.goto(base);
    if (c.gate) { await page.waitForSelector(c.gate); await page.click(c.gate); }
    await page.waitForSelector(c.play); await page.click(c.play);
    await page.waitForSelector(c.main);
    evidence.styles = await page.$$eval(`${c.root}, ${c.elements}`, els => els.map(el => {
      const s = getComputedStyle(el);
      return { element:el.className, select:s.userSelect, webkitSelect:s.webkitUserSelect,
        tap:s.webkitTapHighlightColor, callout:s.getPropertyValue('-webkit-touch-callout'), touch:s.touchAction };
    }));
    assert('play root and interactive elements disable selection', evidence.styles.length > 1 && evidence.styles.every(s => s.select === 'none' && s.webkitSelect === 'none'), JSON.stringify(evidence.styles));
    assert('tap highlight is transparent', evidence.styles.every(s => s.tap.replaceAll(' ', '') === 'rgba(0,0,0,0)'), JSON.stringify(evidence.styles));
    let p = await point(c.main);
    await page.mouse.click(p.x,p.y,{clickCount:2});
    // Capture the native result, without execCommand or simulated selection.
    await page.screenshot({path:`${reports}/${phase}_select_${c.game}.png`});
    await record('double-click main');
    p = await point(c.main); await page.mouse.click(p.x,p.y,{clickCount:3}); await record('triple-click main');
    if (c.text && await page.$(c.text)) {
      p = await point(c.text); await page.mouse.click(p.x,p.y,{clickCount:3}); await record('triple-click HUD');
    }
    p = await point(c.main);
    await page.mouse.move(p.x,p.y); await page.mouse.down(); await sleep(700); await page.mouse.up(); await record('long press');
    await page.evaluate(() => {
      window.__nativeDrags = [];
      document.addEventListener('dragstart', e => {
        const el = e.target;
        queueMicrotask(() => window.__nativeDrags.push({element:el.className, prevented:e.defaultPrevented}));
      });
    });
    await page.mouse.move(p.x,p.y); await page.mouse.down();
    await page.mouse.move(p.x+55,p.y+30,{steps:12}); await page.mouse.up(); await record('mouse drag');
    evidence.images = await page.$$eval('img', els => els.map(el => ({element:el.className, draggable:el.draggable, drag:getComputedStyle(el).webkitUserDrag})));
    assert('images disable native dragging', evidence.images.length > 0 && evidence.images.every(i => !i.draggable && i.drag === 'none'), JSON.stringify(evidence.images));
    // Drag a real visible image as well as the main game object.
    const image = await page.evaluate(() => [...document.images].map(e => ({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>20&&r.height>20&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight).map(({r})=>({x:r.x+r.width/2,y:r.y+r.height/2}))[0]);
    if (image) {
      await page.mouse.move(image.x,image.y); await page.mouse.down(); await page.mouse.move(image.x+60,image.y+30,{steps:12}); await page.mouse.up();
    }
    evidence.drags = await page.evaluate(() => window.__nativeDrags);
    assert('native image/game drag never starts unprevented', evidence.drags.every(d => d.prevented), JSON.stringify(evidence.drags));
    p = await point(c.main); await page.touchscreen.tap(p.x,p.y); await record('touch tap');
    const client = await page.createCDPSession();
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]}); await sleep(750);
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await record('touch long press');
    await client.detach();
    evidence.guards = await page.$eval(c.root, el => ['selectstart','dblclick','contextmenu'].map(type => {
      const e = new MouseEvent(type,{bubbles:true,cancelable:true}); el.dispatchEvent(e); return {type,prevented:e.defaultPrevented};
    }));
    assert('play root guards selection and context-menu defaults', evidence.guards.every(e=>e.prevented), JSON.stringify(evidence.guards));
    // Use Tab (rather than .focus()) to exercise the keyboard-only ring.
    await page.evaluate(() => document.activeElement?.blur());
    let focus;
    for (let i=0;i<40;i++) {
      await page.keyboard.press('Tab');
      focus = await page.evaluate(() => {
        const e=document.activeElement, s=getComputedStyle(e);
        return {control:e.matches('button, [role=button]'), visible:e.matches(':focus-visible'), outline:s.outlineStyle,width:parseFloat(s.outlineWidth),shadow:s.boxShadow};
      });
      if (focus.control) break;
    }
    evidence.focus = focus;
    assert('Tab keeps a visible keyboard focus ring', focus.control && focus.visible && ((focus.outline !== 'none' && focus.width > 0) || focus.shadow !== 'none'), JSON.stringify(focus));
    if (c.reading && await page.$(c.reading)) {
      const reading = await page.$eval(c.reading, el => {
        const e=new MouseEvent('selectstart',{bubbles:true,cancelable:true}); el.dispatchEvent(e);
        return {select:getComputedStyle(el).userSelect,prevented:e.defaultPrevented};
      });
      evidence.reading=reading;
      assert('reading content remains selectable',reading.select==='text'&&!reading.prevented,JSON.stringify(reading));
    }
    if (phase === 'after') {
      const axeSource=readFileSync(axePath,'utf8');
      for(const width of [375,1440]) {
        await page.setViewport({width,height:width===375?812:900});
        // Reload to get a title screen, then start a fresh play screen.
        await page.goto(base); if(c.gate){await page.waitForSelector(c.gate);await page.click(c.gate);}
        await page.waitForSelector(c.play);
        for(const screen of ['title','play']) {
          if(screen==='play'){await page.click(c.play);await page.waitForSelector(c.root);}
          await page.evaluate(axeSource);
          const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
          assert(`axe ${screen} ${width}: zero violations`,!violations.length,JSON.stringify(violations));
        }
      }
    }
  } finally {
    writeFileSync(`${reports}/${phase}_select_${c.game}.json`,JSON.stringify(evidence,null,2)+'\n');
    await context.close();
  }
  return evidence;
}
