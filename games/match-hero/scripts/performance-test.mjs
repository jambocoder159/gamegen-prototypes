import { start, sleep, check, finish, reports } from "./browser-utils.mjs";
import { writeFileSync } from "node:fs";
export async function performanceChecks(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url + "?floor=10");
    await page.waitForSelector(".btn--play");
    await page.click(".btn--play");
    await page.waitForFunction(
      () => window.__mh?.state.enemyPhase === "active",
    );
    await page.evaluate(() => {
      const s = window.__mh.state;
      window.__mh.set({
        levels: { ...s.levels, speed: 50, atk: 15 },
        haste: 8,
      });
    });
    let peak = 0;
    const result = await page.evaluate(async () => {
      const frames = [];
      let start = performance.now(),
        last = start,
        peak = 0;
      window.__mh.match();
      await new Promise((resolve) => {
        const frame = (now) => {
          frames.push(now - last);
          last = now;
          peak = Math.max(
            peak,
            document.querySelector(".combat-overlay").childElementCount,
          );
          if (now - start < 2500) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      return {
        fps: frames.length / ((last - start) / 1000),
        peak,
        frames: frames.length,
        p95: frames.sort((a, b) => a - b)[Math.floor(frames.length * 0.95)],
      };
    });
    check(
      "desktop headless combat ≥50fps",
      result.fps >= 50,
      JSON.stringify(result),
    );
    check("decorative DOM cap ≤24 nodes", result.peak <= 24);
    writeFileSync(
      `${reports}/mh2_performance.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await sleep(1000);
    await page.evaluate(() => window.__mh.match());
    await sleep(50);
    check(
      "reduced motion has no flying gem clones",
      await page.$$(".gem-flight").then((es) => es.length === 0),
    );
  } finally {
    await page.close();
  }
}
if (process.argv[1]?.endsWith("performance-test.mjs")) {
  const { browser, url, stop } = await start();
  try {
    await performanceChecks(browser, url);
  } finally {
    await stop();
  }
  finish();
}
