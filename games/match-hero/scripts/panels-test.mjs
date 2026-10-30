import { logic as L } from "./load-logic.mjs";
import { check, sleep, axe, reports } from "./browser-utils.mjs";
export async function panelChecks(browser, url) {
  const context = await browser.createBrowserContext(),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const lang of ["en", "zh-tw", "zh-cn", "ja"])
      for (const [width, height] of [
        [390, 844],
        [360, 640],
        [844, 390],
        [667, 375],
        [1280, 720],
        [1440, 900],
        [1920, 1080],
      ]) {
        await page.setViewport({ width, height });
        const s = L.newRun(L.seeded(2), 10);
        s.best = 12;
        s.bestEver = 15;
        s.gold = 50000;
        s.shards = s.totalShards = 15;
        await page.goto(url + "?qa=1");
        await page.waitForSelector(".btn--play");
        await page.evaluate(
          (lang, key, value) => {
            localStorage.setItem("match-hero.lang", lang);
            localStorage.setItem(key, value);
          },
          lang,
          L.SAVE_KEY,
          L.serialize(s),
        );
        await page.reload();
        await page.waitForSelector(".btn--play");
        await page.click(".btn--play");
        await page.waitForFunction(
          () => window.__mh?.state.enemyPhase === "active",
        );
        await page.$$eval(".topbar nav button", (es) => es[2].click());
        await page.evaluate(() => {
          window.__mh.set({ enemyTimer: 2.9, enemyAttacks: 2 });
        });
        await page.waitForSelector(".charge-danger");
        const safe = await page.evaluate(() => {
          const a = document.querySelector(".hero").getBoundingClientRect(),
            b = document.querySelector(".enemy").getBoundingClientRect();
          const collide = (r, s) =>
            Math.min(r.right, s.right) > Math.max(r.left, s.left) &&
            Math.min(r.bottom, s.bottom) > Math.max(r.top, s.top);
          return [
            ...document.querySelectorAll(
              '[data-hud="charge"],.charge-danger,[data-rebirth],[data-relics]',
            ),
          ].every((e) => {
            const r = e.getBoundingClientRect();
            return !collide(r, a) && !collide(r, b);
          });
        });
        check(
          `new HUD ${lang} ${width}x${height}: telegraph and buttons clear sprites`,
          safe,
        );
        for (const [name, selector] of [
          ["upgrades", ".topbar nav button:first-child"],
          ["rebirth", "[data-rebirth]"],
          ["relics", "[data-relics]"],
        ]) {
          await page.click(selector);
          await page.waitForSelector(".modal");
          const issues = await page.evaluate(() => {
            const m = document.querySelector(".modal"),
              r = m.getBoundingClientRect(),
              bad = [];
            if (
              r.x < 0 ||
              r.y < 0 ||
              r.right > innerWidth ||
              r.bottom > innerHeight
            )
              bad.push("modal outside");
            for (const e of m.querySelectorAll("button,b,strong,p,small"))
              if (e.scrollWidth > e.clientWidth + 1)
                bad.push(e.className + ": " + e.textContent);
            return bad;
          });
          check(
            `${name} ${lang} ${width}x${height}: text fits`,
            issues.length === 0,
            issues.join(";"),
          );
          if (name === "rebirth" || name === "relics") {
            check(`${name} ${lang} ${width}: lifetime passive visible`, await page.$eval('[data-shard-passive]', e => e.textContent.includes('15') && e.textContent.includes('30%')));
          }
          if (name !== "rebirth") {
            const clear = await page.evaluate(() => {
              const a = document
                .querySelector(".modal")
                .getBoundingClientRect();
              return [".hero", ".enemy"].every((selector) => {
                const b = document
                  .querySelector(selector)
                  .getBoundingClientRect();
                return !(
                  a.left < b.right &&
                  a.right > b.left &&
                  a.top < b.bottom &&
                  a.bottom > b.top
                );
              });
            });
            check(
              `${name} ${lang} ${width}x${height}: panel clears sprites`,
              clear,
            );
          }
          if (lang === "en" && [390, 1280].includes(width))
            await axe(page, `${name} v2 ${width}`);
          if (name === "upgrades") {
            await page.$$eval(".purchase-mode button", (es) => es[1].click());
            check(
              `Max ${lang} ${width}: multi-level preview`,
              await page.$eval('[data-upgrade="atk"]', (e) =>
                /\+\d+/.test(e.textContent),
              ),
            );
          }
          await page.keyboard.press("Escape");
        }
      }
    // Exercise real controls for permanent purchases and the destructive reset.
    await page.click("[data-relics]");
    await page.click('[data-relic="sword"]');
    await page.keyboard.press("Escape");
    check("spending shards keeps HUD passive", await page.$eval('[data-shard-bonus]', e => e.textContent === '+30%'));
    const attack = await page.$eval("[data-atk]", (e) => +e.dataset.atk);
    check("relic purchase changes live attack", attack > 5);
    await page.click("[data-rebirth]");
    await page.click("[data-confirm-rebirth]");
    await sleep(100);
    const run = await page.evaluate(() => window.__mh.state);
    check(
      "confirmed rebirth resets gold/upgrades and keeps relics/shards/best",
      run.floor === 1 &&
        run.gold === 0 &&
        run.relics.sword === 1 &&
        run.rebirths === 1 &&
        run.bestEver === 15 &&
        run.shards > 14,
    );
    check(
      "new screens have no runtime errors",
      errors.length === 0,
      errors.join(";"),
    );
  } finally {
    await context.close();
  }
}
