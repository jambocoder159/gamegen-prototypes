# Tap Garden v2 （芽芽花園 / タップガーデン）

Tap the magic pot for dew, grow and merge nine plant tiers, and buy nine upgrade
lines. Clear garden stages and plant-gated bosses, then rebirth from stage 10 for
sun coins. Twelve permanent relics and a +5% lifetime bonus per earned coin make
later gardens faster. React 19 + TypeScript + Vite; GameGen HTML ZIP layout.

## Run and verify

```bash
npm install
npm run dev
npm run build           # strict TypeScript + production build
npm run check:i18n      # four matching, nonempty dictionaries
npm run test:logic      # actual TypeScript logic bundled with esbuild
npm run test:sim        # five standard-player runs; asserts economy targets
npm run test:headless   # builds, serves, drives Chrome; screenshots in qa/
npm run pack            # builds tap-garden.zip, index.html and poster.png at root
```

`npm run preview` retains port 4173. The headless suite starts its own Vite preview
on **4175**, configurable with `PORT=4180 npm run test:headless`, and stops only
its own process. It also tests an isolated `/tap-garden/` mount. If a port is busy,
inspect `ss -ltnp` and use `kill <pid>` only for a process you own.
Axe uses `/workspace/deploy/node_modules/axe-core/axe.min.js`; if absent, the suite
prints an explicit skip. Chrome must be at `/usr/bin/google-chrome`.

## Play

- Tap for dew; buy seeds; select two matching plants to merge. Select a plant
  then an empty plot to move it. Level 9 unlocks a one-time celebration.
- Open **Upgrades** for Pot Power, Pot Warmth, Crit Chance, Crit Power, Auto Tap,
  Fertilizer, Merge Burst, Seed Quality and plot expansion (9→16). Buy ×1 or Max.
- Stages count earned dew, independently of spending. Every fifth stage also
  needs a sufficiently high plant. Clearing grants 30 seconds of passive dew.
- Open **Rebirth** from stage 10, inspect coins and reset/keep lists, and confirm.
  Dew, plants, expansions, upgrades, stage and seed prices restart. Coins, lifetime
  bonus, relics, plant collection, best stage, rebirth count and settings persist.
- **Relics** cost 8 coins for a seeded random draw or 20 for a chosen unlock.
  Duplicate draws add one level; upgrade prices scale by 1.5 per level. All twelve
  relics have caps and effect previews in the codex.
- Offline plants earn at 50% for up to two hours; Moon Watch increases both limits.
  Ancient Acorn gives starting dew when a new run begins.

Keys: **arrows** move plot focus; **Enter/Space** act; **T** taps; **B** buys a seed;
**G** opens Upgrades; **R** opens Relics; **E** opens Rebirth; **Esc** closes dialogs.
Dialog focus stays inside and returns to its opener. All purchases announce their
result. Sound and language controls remain available on the garden and title.

## Economy simulation

All game constants are in `src/game/config.ts`. Adopted values:
`STAGE_BASE=8000`, `STAGE_GROWTH=2`, `REBIRTH_COIN_MULT=10`,
`LIFETIME_BONUS_PER_COIN=0.05`. Other upgrade and relic formulas follow PLAN §3.
The higher starting stage goal keeps the first rebirth within 10–20 minutes;
coin income and lifetime bonuses provide the required later-run acceleration.

The simulation uses the shipped logic: 4 manual taps/s, immediate merges, and a
repeated greedy affordable purchase decision every 10 seconds. Auto taps use
expected crit income; manual crits and seed/relic choices use seeded RNG. At
stage 10+, rebirth becomes worthwhile when the next stage ETA exceeds 60 seconds
(or a boss plant requirement blocks it), checked after purchases. Coins are spent
on weighted greedy relic purchases/upgrades, then draws. An acorn bought after a
rebirth benefits the following run. This deterministic policy is a balance check,
not a prediction of human behavior.

Actual `npm run test:sim` output (minutes rounded to one decimal):

| Run | to stage 10 (min) | rebirth at (min) | max stage | sun coins | speed-up to stage 10 |
|---|---|---|---|---|---|
| 1 | 10.7 | 10.8 | 10 | 30 | — |
| 2 | 4.2 | 4.3 | 10 | 30 | 60% |
| 3 | 2.3 | 4.0 | 12 | 91 | 45% |
| 4 | 1.0 | 3.3 | 15 | 224 | 56% |
| 5 | 0.3 | 3.2 | 18 | 517 | 73% |

Upgrade levels at each rebirth:

| Run | power | warmth | crit | critPower | auto | fert | merge | seed | plots |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 63 | 25 | 22 | 22 | 29 | 37 | 24 | 12 | 12 |
| 2 | 64 | 25 | 22 | 23 | 30 | 38 | 19 | 11 | 12 |
| 3 | 73 | 33 | 26 | 27 | 36 | 47 | 27 | 12 | 13 |
| 4 | 90 | 41 | 35 | 38 | 40 | 58 | 39 | 12 | 14 |
| 5 | 107 | 50 | 40 | 47 | 40 | 68 | 50 | 12 | 15 |

Relic levels at each rebirth (bought with the coins of earlier runs):

| Run | lens | sun | moon | bee | clover | thunder | trowel | cloud | lotus | ladybug | can | acorn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| 5 | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | 5 |
| after 5 | 9 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 3 | 1 | 7 |

Assertions pass: first rebirth **10.8 min**; successive stage-10 speedups
**60%, 45%, 56%** through run 4; run 4 reaches **stage 15**.

## Layout, assets and saves

Portrait, near-square and wide layouts update with viewport aspect without losing
state. Four languages (English, 繁體中文, 简体中文, 日本語) share identical keys and
switch live. Numbers share K/M/B/T/Qa/Qi/Sx/Sp/Oc/No/Dc, then scientific notation.
Dialogs scroll internally on short displays; reduced motion disables ambient
movement and effects. Art and all twelve audio files preload before Enter;
missing art/audio have placeholders/silence. Fonts are local system fonts.

The save remains at `tap-garden.save`, now **v2**. v1 dew, plant positions,
collection and seed count migrate; v1 `tapLevel - 1` becomes Pot Power's zero-based
level. Enough plots unlock to retain every old plant. Each field is validated;
corrupt JSON or unknown versions reset safely. Autosaves occur every five seconds
and on page hide. Reset clears all game progress, including coins and relics.
Storage failures do not prevent play. The title bot uses real logic in memory
without writing player saves. There is no analytics, tracking or external font.

`src/game/{logic,upgrades,relics,stages,rebirth,save}.ts` implement the systems;
`useGarden.ts` binds them to React. `src/platform`, `src/services`, `src/i18n` and
`src/config/assets.ts` own loading, audio, layout, localization and asset paths.

## Remaining human checks

Procedural audio still needs listening review (`AUDIO_NOTES.md`). Balance needs
human playtesting and physical-device checks. `icon_plant_6` includes a decorative
dew pile in its supplied art and is used as provided. Nothing is deployed or pushed.
