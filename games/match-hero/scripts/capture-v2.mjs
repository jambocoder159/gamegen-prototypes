import { writeFileSync } from "node:fs";
import {
  start,
  sleep,
  reports,
  check,
  finish,
  axe,
  overflow,
} from "./browser-utils.mjs";
const { browser, url, stop } = await start();
try {
  let page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("match-hero.lang", "zh-tw");
    localStorage.setItem("match-hero.coached", "1");
    localStorage.setItem("match-hero.muted", "1");
  });
  const combatBoard = ["sword","sword","mana","sword","coin","heart","heart","coin","sword","sword","mana","heart","fire","sword","mana","heart","coin","fire","mana","heart","coin","fire","sword","mana","coin","fire","sword","mana","heart","coin","sword","mana","heart","coin","fire","sword"];
  for (const [w, h] of [
    [390, 844],
    [1280, 720],
    [844, 390],
  ]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(url + "?floor=10");
    await page.waitForSelector(".btn--play");
    if (w === 390)
      await page.screenshot({ path: `${reports}/mh2_after_title_390x844.png` });
    await page.click(".btn--play");
    await page.waitForFunction(
      () => window.__mh?.state.enemyPhase === "active",
    );
    await page.waitForSelector(".floor-toast", { hidden: true });
    await page.evaluate((board) => {
      const s = window.__mh.state;
      window.__mh.set({
        levels: { ...s.levels, atk: 10, speed: 50, hp: 10 },
        board,
        autoTimer: 0,
        haste: 8,
        hp: 240,
        gold: 12000,
        best: 10,
        bestEver: 10,
        shards: 15,
        totalShards: 15,
      });
      window.__mh.match();
    }, combatBoard);
    await page.waitForSelector(".gem-flight");
    await page.waitForFunction(() => {
      const visible = e => +getComputedStyle(e).opacity > .3;
      const ready = document.querySelector(".hero").getAttribute("src").includes("slash") &&
        [...document.querySelectorAll('.gem-flight[src*="gem_sword"]')].some(visible) &&
        [...document.querySelectorAll('.combat-fx[src*="fx_slash"]')].some(visible) &&
        [...document.querySelectorAll('.damage-auto,.damage-crit')].some(visible);
      if (ready) {
        window.__mh.freezeForCapture();
        document.getAnimations().forEach(a => a.pause());
      }
      return ready;
    }, {polling: 'raf'});
    // Freeze Web Animations on a real combat frame; keep the browser clock live
    // so Chrome can complete its screenshot rendering lifecycle.
    await page.screenshot({ path: `${reports}/mh2_after_fight_${w}x${h}.png` });
    if (w === 390) {
      await page.screenshot({ path: `${reports}/mh2_after_fight_combo_390x844.png` });
      const evidence = await page.evaluate(() => ({
        heroSlash: document.querySelector('.hero').src.includes('slash'),
        slash: [...document.querySelectorAll('.combat-fx[src*="fx_slash"]')].filter(e => +getComputedStyle(e).opacity > .3).length,
        flyingAttackGems: [...document.querySelectorAll('.gem-flight[src*="gem_sword"]')].filter(e => +getComputedStyle(e).opacity > .3).length,
        damageNumbers: [...document.querySelectorAll('.damage-auto,.damage-crit')].filter(e => +getComputedStyle(e).opacity > .3).length,
      }));
      check('combo capture contains slash, flying attack gem and damage number', evidence.heroSlash && evidence.slash > 0 && evidence.flyingAttackGems > 0 && evidence.damageNumbers > 0, JSON.stringify(evidence));
      writeFileSync(`${reports}/mh2_combo.json`, JSON.stringify(evidence,null,2)+'\n');
    }
    const issues = await page.evaluate(overflow);
    check(`fight ${w}x${h} fits`, !issues.length, JSON.stringify(issues));
    await page.close();
    page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("match-hero.lang", "zh-tw");
      localStorage.setItem("match-hero.coached", "1");
      localStorage.setItem("match-hero.muted", "1");
    });
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(url + "?floor=10");
  await page.waitForSelector(".btn--play");
  await page.click(".btn--play");
  await page.waitForFunction(() => window.__mh?.state.enemyPhase === "active");
  await page.waitForSelector(".floor-toast", { hidden: true });
  await page.evaluate(() => {
    window.__mh.set({
      enemyTimer: 2.9,
      enemyAttacks: 2,
      autoTimer: 0,
      hp: 90,
      gold: 50000,
      best: 10,
      bestEver: 10,
      shards: 15,
      totalShards: 15,
    });
  });
  await page.click('button[aria-label="暫停"]');
  await page.waitForSelector(".charge-danger");
  await page.screenshot({ path: `${reports}/mh2_after_enemy_telegraph.png` });
  for (const [selector, name] of [
    ["[data-rebirth]", "rebirth_modal"],
    ["[data-relics]", "relics"],
    [".topbar nav button:first-child", "upgrades"],
  ]) {
    await page.click(selector);
    await page.waitForSelector(".modal");
    await page.screenshot({ path: `${reports}/mh2_after_${name}.png` });
    await axe(page, name);
    await page.keyboard.press("Escape");
  }
  await page.setViewport({ width: 432, height: 768 });
  await page.goto(url + "?floor=5");
  await page.waitForSelector(".btn--play");
  await page.click(".btn--play");
  await page.waitForFunction(() => window.__mh?.state.enemyPhase === "active");
  await page.waitForSelector(".floor-toast", { hidden: true });
  await page.evaluate(() => {
    window.__mh.set({
      levels: {
        atk: 10,
        speed: 15,
        crit: 3,
        hp: 10,
        power: 3,
        gold: 3,
        focus: 3,
      },
      hp: 250,
      haste: 8,
    });
    window.__mh.match();
  });
  await page.waitForSelector(".gem-flight");
  await page.waitForFunction(() =>
    document.querySelector(".hero").getAttribute("src").includes("slash"),
  );
  await page.screenshot({ path: "public/poster.png" });
  await page.close();
} finally {
  await stop();
}
finish();
