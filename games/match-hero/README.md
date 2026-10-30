# Match Hero Tower v2 · 消消勇者塔

React 19 + TypeScript + Vite pixel match-3 idle battler. Match gems, upgrade the hero, watch enemy charge warnings, and rebirth from floor 10 to unlock permanent relics.

```sh
npm install
npm run dev
npm run build
npm run check:i18n
npm run test:logic
npm run test:sim
npm run test:sprites
PORT=4251 npm run test:title
PORT=4251 npm run test:hud
PORT=4251 npm run test:enemy
PORT=4251 npm run test:headless
PORT=4251 npm run performance
PORT=4251 npm run capture-v2
npm run pack
```

Build before browser tests, keep the bundle unchanged while they run, and run suites sequentially on a given port. Each owns and stops its preview process; never kill other projects' servers. Chrome is `/usr/bin/google-chrome`; axe is installed locally as the `axe-core` dev dependency. Reports go to `/workspace/gamegen-games/_reports/`.

## Play

Tap adjacent gems or swipe to match three. Four in a line creates a star with a 3×3 blast. Sword/flame deal damage, crystals give SP, hearts heal, coins earn gold. Fireball costs 30 SP, Heal 40, Haste 25. Arrow keys move focus, Enter/Space selects/swaps, 1/2/3 casts skills, P pauses, Escape closes dialogs.

Gold upgrades last until rebirth. ×1/Max previews current and resulting stats using the same production formulas as the HUD. Retreat preserves upgrades and gold, returning to the first floor of the five-floor section.

At a run best of floor 10, confirm rebirth to reset the run and receive `floor(.6 × (best−5)^1.35 × (1+.1×crownLevel))` shards (minimum 1). Shards, 11 relics, all-time best, rebirth count and settings survive. Relic costs and limits are centralized in `src/game/config.ts`. Starting Boots apply on the next rebirth and are capped at half the previous run best. Each lifetime earned shard permanently adds 2% to all damage and gold, capped at 100% after 50 shards; spending shards retains this passive. The confirmation dialog, relic panel and statistics show the bonus in all four languages. Heirloom Sword gives +20% damage per level.

## Combat and layout

One enemy exists at a time: 400ms entry → active → 450ms death → 60ms empty stage → next enemy. Entry and death are immune and do not accumulate attacks. Normal enemies attack every 2.7 seconds; bosses every 2.2, with each third strike taking 3.3 seconds and dealing double damage. The last 30% of charge shows an icon and stronger windup.

Characters face each other using the original images, with no horizontal flipping. Feet align at 84% of the stage across all three backgrounds. Portrait uses a vertical layout; landscape/desktop put the board on the right. Relics/upgrades dock below the battlefield on phones and to the right on wide screens. They retain keyboard focus, scroll and restore focus on close.

Decorative effects use a bounded fixed overlay and actual DOM coordinates, with at most 24 nodes. Reduced motion keeps feedback but removes travel, lunges and shaking. Settings independently disable damage numbers and screen shake. The existing gesture guards prevent selection/tap-blue while preserving native form controls and selectable prose.

## Persistence and languages

`match-hero.save.v2` automatically reads a v1 save if v2 does not exist, retaining all original progress and defaulting permanent fields. The v1 key is not deleted. Old enemy HP is retained even when greater than the newly balanced maximum. Invalid data resets safely; unavailable storage does not stop play.

Traditional Chinese, Simplified Chinese, English and Japanese have 131 matching keys. Browser language sets the initial choice; explicit choices persist separately from the run.

`?floor=N` (1–100) creates an isolated debug run and never overwrites a real save. `?qa=1` exposes `window.__mh` for browser tests with persisted fixtures. Ordinary play has no debug hook.

## Back to catalog

The title screen and in-game Settings dialog have a four-language “Back to catalog” link (`href="../"`), styled as a 48px secondary button with keyboard focus and existing button sounds. Activation synchronously saves the real run through the pagehide/visibilitychange persistence function, bypasses the autosave interval, and stops BGM before navigation. The title never saves its bot demo; debug adventures preserve real saves. The link participates in the dialog focus trap and never appears in the play HUD.

`test:headless` covers navigation, immediate saves, accessibility and keyboard behavior; `test:title` includes the link in all seven viewport checks. Screenshots are `back_match-hero_title.png` and `back_match-hero_pause.png` in the shared reports directory. The task's external axe path is unavailable, so audits use the existing local `axe-core` dependency.

## Validation status

- Logic: 19 checks, including v1 fixtures, lifecycle, charge, heavy strikes, relics, rebirth and lifetime shard multipliers across every damage/gold source.
- HUD: 556 checks, including statistics content bounds, 4 languages × 7 sizes, axe, passive labels, preview, keyboard and real purchases/reset.
- Enemy swap: 72 checks, including 100 samples at 50ms, four kills including a boss, and eight sprites × seven sizes. The wider bat has a separate 36%-wide, 52%-high contain box.
- Title: 112 layout checks with the catalog link. Full headless: 853/853 checks, including 125 catalog checks and 18 axe audits with zero violations. It also covers input, saves, skills, selection, fallback, subpath hosting and a bounded-effect performance sample (~60fps on desktop Chrome, not a mobile device guarantee).
- **Balance 8/8:** standard reaches floor 10 in 6.21 minutes, auto-only 19.97; standard has 0 retreats through floor 20, auto 5. Second-run floor 10 is 4.50 minutes, 27.4% faster. Average boss damage is 59.9% / 44.8% for the standard first / second runs.
- Sprites: 43/43 pass in the current workspace (including the 359×225 bat). The catalog change leaves the supplied textures and checker unchanged. See `sprite_check_match-hero.txt`.

Full constants, simulation table and limitations: `PLAN.md`. Final measured results: `_reports/mh2_completion.md`.

## Assets and package

Individual `icon_*`, `logo_base` and `fx_*` PNGs replace the deleted atlas; there are no atlas crop coordinates. All art uses pixelated rendering. Raw art and processing provenance are documented in `assets/MANIFEST.md`; this implementation does not edit the supplied textures.

`public/poster.png` is an actual 432×768 fight capture. `scripts/capture-v2.mjs` recreates it and the nine requested v2 screenshots, including a frozen real combat frame with slash, flying sword gems and damage numbers. `npm run pack` rebuilds `match-hero.zip` with `index.html` and `poster.png` at the ZIP root. No commit or push is performed.
