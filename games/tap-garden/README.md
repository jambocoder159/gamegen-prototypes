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
npm run test:title      # title/loading viewport matrix + non-overlap
npm run test:headless   # builds, serves, drives Chrome; screenshots in qa/
npm run pack            # builds tap-garden.zip, index.html and poster.png at root
```

`npm run preview` retains port 4173. The headless suite starts its own Vite preview
on **4226**, configurable with `PORT=4226 npm run test:headless`, and stops only
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

All game constants are in `src/game/config.ts`. Final adopted values:
`INCOME_BASE=0.5`, `INCOME_GROWTH=2.5`, `SEED_GROWTH=1.06`, `SEED_SOFT_CAP=100`, `WARMTH_PER_LEVEL=0.002`, `STAGE_BASE=16000`, `STAGE_GROWTH=2`, `REBIRTH_COIN_MULT=10`, `LIFETIME_BONUS_PER_COIN=0.05`.

Plants produce `0.5 × 2.5^(tier−1)` dew/s. Each merge gives 25% more plant
production than its two inputs, before the separate merge reward. The rate pill
shows plant production with enough precision to expose small merges in large gardens.
Seeds cost `ceil(10 × 1.06^min(n,100) × (1 + 0.03 × max(0,n−100)) × (1−discount))`.
After 100 purchases the curve grows linearly. Warmth adds **0.2%** of plant
production per level per tap. This avoids multiplying passive production into
unbounded click income too early. The higher stage base preserves the first-run pace.

The intended production split is **60–70% manual clicks in the first minute of
a new account**, shifting to **at least 70% auto taps + plants over developed
runs**. This is measured at four manual taps/s. Bonus dew from merges and chests
is separate; it is included in earned-dew totals and reported as a share of all
earned dew. Auto taps use expected crit income, so their share is deterministic.

The simulation uses the shipped logic: four manual taps/s, immediate manual
merges, Auto-merge enabled from stage 2, and repeated greedy affordable purchases
every ten seconds. Full-board automatic merging uses the real tick function.
At stage 10+, rebirth occurs after purchases when the next stage ETA exceeds 60s
or its boss plant is missing. Coins are spent on weighted greedy relic purchases,
then draws. Acorns purchased after rebirth benefit the following run. This
reproducible policy is a balance check; human playtesting is still needed.

Actual `npm run test:sim` output (minutes rounded to one decimal):

| Run | to stage 10 (min) | rebirth at (min) | max stage | sun coins | speed-up to stage 10 |
|---|---|---|---|---|---|
| 1 | 10.9 | 11.0 | 10 | 35 | — |
| 2 | 2.5 | 3.5 | 12 | 96 | 77% |
| 3 | 0.3 | 1.5 | 17 | 341 | 87% |
| 4 | 0.2 | 0.7 | 18 | 562 | 49% |
| 5 | 0.1 | 1.7 | 21 | 974 | 61% |

Upgrade levels at each rebirth:

| Run | power | warmth | crit | critPower | auto | fert | merge | seed | plots |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 66 | 29 | 23 | 24 | 32 | 44 | 24 | 12 | 13 |
| 2 | 71 | 37 | 26 | 27 | 37 | 54 | 36 | 12 | 15 |
| 3 | 97 | 54 | 38 | 41 | 40 | 75 | 60 | 12 | 16 |
| 4 | 86 | 49 | 33 | 35 | 40 | 68 | 57 | 12 | 16 |
| 5 | 121 | 68 | 40 | 54 | 40 | 91 | 74 | 12 | 16 |

Relic levels at each rebirth (bought with the coins of earlier runs):

| Run | lens | sun | moon | bee | clover | thunder | trowel | cloud | lotus | ladybug | can | acorn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 7 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 6 |
| 5 | 9 | 10 | 3 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 4 | 7 |
| after 5 | 11 | 11 | 7 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 6 | 9 |

Income shares (production only; merge/chest bonuses reported separately):
| Run | click | auto | passive | bonus / all earned | first 60s click | auto-merge |
|---|---|---|---|---|---|---|
| 1 | 17.8% | 58.8% | 23.4% | 19.0% | 66.1% | on |
| 2 | 13.9% | 55.8% | 30.2% | 53.5% | 18.8% | on |
| 3 | 12.3% | 61.7% | 25.9% | 62.8% | 12.6% | on |
| 4 | 12.3% | 60.9% | 26.8% | 86.0% | run <60s | on |
| 5 | 13.2% | 65.0% | 21.8% | 50.0% | 12.4% | on |

All targets pass: first rebirth **11.0 min**; stage-10 speedups **77%, 87%, 49%**
through run 4; run 4 reaches **stage 18**. The first minute of run 1 is **66.1%**
manual clicks; its full-run auto/plant share is **82.2%**.

## Playtest fixes and new controls

- A three-step, icon-led coach guides ten taps, two seed purchases, then a merge.
  It advances after actions, has Skip, and reopens with **?**. A separate
  `tap-garden.coach` completion flag prevents repeating it on reload.
- The pot is the primary top-center target, above plots in portrait and regular
  desktop layouts. Phone pot art is at least 40% of viewport width; short landscape
  moves controls to the side. HUD labels are at least 18px, key numbers 20px, and
  icon buttons 48px. Short phones show the offline ratio in Settings to save space.
- **Merge all** performs one pass over disjoint matching pairs, without using a
  newly merged plant again. It is in Settings and replaces Buy seed when full.
  Any two matching unlocked plants can be selected and merged, so adjacency
  does not restrict this operation. **Auto-merge** unlocks at stage 2, has a
  persisted Settings switch, and is offered beside the pot when the garden is
  full. It runs a pass only when all open plots are occupied. Its preference
  survives rebirth, with the stage-2 gate applied in each new run.
- Plot expansion is sequential. Each lock shows its price; the **next** plot
  highlights when affordable and can be tapped to buy. Later locks require earlier
  expansions. The Plots upgrade is an alternate purchase of that same next plot,
  with the same relic discount and feedback.
- **Stats** shows lifetime manual taps/crits, lifetime and run dew, merges,
  highest tier, stages cleared, rebirths, relic count, active play time, best stage,
  current plant+auto production, run click/auto/plant shares, run bonus dew, and
  lifetime offline earnings. Rebirth clears only run counters. New counters in old
  v2 saves start at zero; historical activity cannot be reconstructed.
- Auto Tap uses the pot's tap frames and number cues, limited to two visual taps/s
  with aggregated values. Critical manual taps play `sfx_crit`, show a star burst,
  larger gold number, pot shake and brief screen flash. Reduced motion removes
  movement/flash while retaining readable state and reward cues.
- Each plant gets a staggered production number. At most **three** plant numbers
  and **four** pot numbers are visible. Gardens with more than eight producers
  aggregate four plants per cue (Σ), rotating through all flowers. **Floating
  numbers** is an accessible Settings switch, defaults on, persists as a validated
  boolean, and controls both plant and pot numbers.
- The HUD (where space permits), Settings and welcome-back dialog show the current
  offline percentage and hour cap, including Moon Watch, in every language.

## Layout, assets and saves

Portrait, near-square and wide layouts update with viewport aspect without losing
state. Four languages (English, 繁體中文, 简体中文, 日本語) share identical keys and
switch live. On first use the first supported entry in `navigator.languages`
selects the language: zh-TW/HK/MO/Hant → zh-tw, zh-CN/SG/Hans/plain zh → zh-cn,
ja* → ja, en* → en; otherwise English. A saved valid player choice overrides it.
Numbers share K/M/B/T/Qa/Qi/Sx/Sp/Oc/No/Dc, then scientific notation.
Dialogs scroll internally on short displays; reduced motion disables ambient
movement and effects. Art and all twelve audio files preload before Enter;
missing art/audio have placeholders/silence. Fonts are local system fonts.

The save remains at `tap-garden.save`, now **v2**. v1 dew, plant positions,
collection and seed count migrate; v1 `tapLevel - 1` becomes Pot Power's zero-based
level. Enough plots unlock to retain every old plant. Each field is validated;
corrupt JSON or unknown versions reset safely. Autosaves occur after each player action, every five seconds, and on pagehide
or visibilitychange. Saves larger than 50KB reset safely. New counters and
Auto-merge are optional, validated v2 fields; v1 migration remains supported. Reset clears all game progress, including coins and relics.
Storage failures do not prevent play. The title bot uses real logic in memory
without writing player saves. There is no analytics, tracking or external font.

`src/game/{logic,upgrades,relics,stages,rebirth,save}.ts` implement the systems;
`useGarden.ts` binds them to React. `src/platform`, `src/services`, `src/i18n` and
`src/config/assets.ts` own loading, audio, layout, localization and asset paths.

## Remaining human checks

Procedural audio still needs listening review (`AUDIO_NOTES.md`). Balance needs
human playtesting and physical-device checks. `icon_plant_6` includes a decorative
dew pile in its supplied art and is used as provided. Nothing is deployed or pushed.

Verification additionally covers all merge tiers, one-pass/full-board merging,
source accounting, old v2 counter migration, onboarding progress/reopen, direct
plot purchase, Stats values, floating-number persistence/aggregation, automatic
pot cues, crit/reduced-motion effects, browser-language mapping, and all new
dialogs. Axe runs on title, gameplay, upgrades, relics, rebirth, Stats, Settings,
offline, reset and celebration at 375px and 1440px. Final screenshots are in
`../_reports/fix_tap-garden_*.png`.
