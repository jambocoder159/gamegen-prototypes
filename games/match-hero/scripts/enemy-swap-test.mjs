import { writeFileSync } from "node:fs";
import { start, sleep, check, finish, reports } from "./browser-utils.mjs";
import { logic as L } from "./load-logic.mjs";
import { pathToFileURL } from "node:url";
export async function enemySwapChecks(browser, url) {
  const page = await browser.newPage();
  const layouts = [];
  let samples = 0,
    overlap = 0,
    multiple = 0,
    entryChanges = 0,
    oldNodes = 0;
  try {
    await page.evaluateOnNewDocument(() =>
      localStorage.setItem("match-hero.lang", "en"),
    );
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url + "?floor=4");
    await page.waitForSelector(".btn--play");
    await page.click(".btn--play");
    await page.waitForFunction(
      () => window.__mh?.state.enemyPhase === "active",
    );
    for (let wave = 0; wave < 4; wave++) {
      await page.waitForFunction(
        () => window.__mh.state.enemyPhase === "active",
      );
      await page.evaluate(() => {
        window.__oldEnemy = document.querySelector(".enemy");
        window.__oldId = window.__mh.state.enemyId;
        window.__mh.kill();
      });
      let sawEntry = false;
      for (let i = 0; i < 25; i++) {
        const result = await page.evaluate(() => {
          const s = window.__mh.state,
            imgs = [...document.querySelectorAll(".battle__stage img.enemy")],
            hero = document.querySelector(".hero").getBoundingClientRect();
          return {
            count: imgs.length,
            overlap: imgs.some((e) => {
              const r = e.getBoundingClientRect();
              return (
                Math.min(r.right, hero.right) - Math.max(r.left, hero.left) >
                  4 &&
                Math.min(r.bottom, hero.bottom) - Math.max(r.top, hero.top) > 4
              );
            }),
            oldConnected: window.__oldEnemy.isConnected,
            changed: s.enemyId !== window.__oldId,
            phase: s.enemyPhase,
            entryChanged:
              s.enemyPhase === "entering" &&
              (s.enemyTimer !== 0 ||
                s.autoTimer !== 0 ||
                s.enemyHp !==
                  Number(
                    document.querySelector("[data-enemy-max]").dataset.enemyMax,
                  )),
          };
        });
        samples++;
        if (result.count > 1) multiple++;
        if (result.overlap) overlap++;
        if (result.entryChanged) entryChanges++;
        if (result.changed && result.oldConnected) oldNodes++;
        if (result.phase === "entering") sawEntry = true;
        await sleep(50);
      }
      check(`swap ${wave + 1}: next entry observed`, sawEntry);
    }
    check(
      `enemy count ≤1 in ${samples} samples`,
      multiple === 0,
      `${multiple} failures`,
    );
    check(
      "old enemy removed before next enters",
      oldNodes === 0,
      `${oldNodes} failures`,
    );
    check(
      "entry HP and attack timers remain frozen",
      entryChanges === 0,
      `${entryChanges} failures`,
    );
    check(
      "hero/enemy overlap never exceeds 4px",
      overlap === 0,
      `${overlap} failures`,
    );
    const scenarios = [
      ["slime", 1, 1],
      ["bat", 1, 2],
      ["skeleton", 1, 3],
      ["goblin", 6, 1],
      ["ghost", 6, 2],
      ["golem", 11, 2],
      ["dragon", 5, 1],
      ["demon", 10, 1],
    ];
    for (const [name, floor, wave] of scenarios) {
      const s = L.newRun(L.seeded(1), floor);
      s.wave = wave;
      await page.goto(url + "?qa=1");
      await page.waitForSelector(".btn--play");
      await page.evaluate(
        (key, value) => localStorage.setItem(key, value),
        L.SAVE_KEY,
        L.serialize(s),
      );
      await page.reload();
      await page.waitForSelector(".btn--play");
      await page.click(".btn--play");
      await page.waitForSelector(".enemy");
      await page.waitForFunction(() => window.__mh.state.enemyPhase === "active");
      check(
        `${name}: sprite loaded`,
        await page.$eval("img.enemy", (e) => e.complete && e.naturalWidth > 0),
      );
      await page.click('button[aria-label="Pause"]');
      await page.waitForSelector(".floor-toast", { hidden: true });
      for (const [width, height] of [[390,844],[360,640],[844,390],[667,375],[1280,720],[1440,900],[1920,1080]]) {
        await page.setViewport({width,height});
        await page.waitForFunction(() => document.querySelector('.game').classList.contains('game--landscape') === (innerHeight <= 520 || innerWidth > innerHeight * 1.3));
        // Resize handlers and ResizeObserver both commit on animation frames.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const layout = await page.evaluate(() => {
          const e = document.querySelector(".enemy"), h = document.querySelector(".hero"), stage = document.querySelector(".battle__stage").getBoundingClientRect();
          const r = e.getBoundingClientRect(), hero = h.getBoundingClientRect();
          const inside = r.left >= stage.left && r.right <= stage.right && r.top >= stage.top && r.bottom <= stage.bottom;
          const clear = r.left >= hero.right + 4;
          const stageTall = document.querySelector(".game--landscape") ? stage.height >= innerHeight * .45 : stage.height > 0;
          // object-fit:contain must preserve the delivered aspect ratio inside its box.
          const scale = Math.min(r.width/e.naturalWidth, r.height/e.naturalHeight);
          return {inside, clear, stageTall, natural:[e.naturalWidth,e.naturalHeight], box:[r.width,r.height], drawn:[e.naturalWidth*scale,e.naturalHeight*scale], stage:[stage.width,stage.height]};
        });
        layouts.push({name,width,height,...layout});
        check(`${name} ${width}x${height}: inside stage and clear of hero`, layout.inside && layout.clear && layout.stageTall, JSON.stringify(layout));
        if (width === 390) await page.screenshot({ path: `${reports}/mh2_enemy_${name}.png` });
      }
      await page.setViewport({width:390,height:844});
    }
    writeFileSync(
      `${reports}/mh2_enemy-swap.json`,
      JSON.stringify(
        { samples, multiple, oldNodes, entryChanges, overlap, layouts },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await page.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { browser, url, stop } = await start();
  try {
    await enemySwapChecks(browser, url);
  } finally {
    await stop();
  }
  finish();
}
