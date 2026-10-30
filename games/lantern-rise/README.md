# Lantern Rise (升燈)

A one-finger "hold to rise, release to fall" endless flyer. Guide a paper sky
lantern through crows and storm clouds, follow the spark trail to refuel, and
fly as far as you can. Layered paper-cut art, four languages, built with
React 19 + TypeScript + Vite.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build / test / pack

```bash
npm run build          # tsc --noEmit + vite build  -> dist/ (index.html + poster.png at root)
npm run check:i18n     # verify the 4 language files share keys and have no empty values
npm run test:logic     # countdown, oil endurance, validated deterministic saves, spark bounds, 4-minute bots
PORT=4321 npm run test:title  # title/art/link non-overlap across desktop and phone viewports
PORT=4322 npm run test:headless  # build, serve at catalog subpath, browser QA, screenshots to qa/
npm run pack           # build then write lantern-rise.zip (contents of dist/ at the zip root)
```

`npm run test:headless` needs Chrome at `/usr/bin/google-chrome`. Logic tests use Node 24 built-in TypeScript support.

## Controls / keys

- **Hold** anywhere on the play field (pointer or touch, multitouch-safe) to thrust up; **release** to fall.
- **Space**, **W**, or **↑** also thrust.
- **P** or **Esc** toggles pause.
- Buttons (top corners): pause/resume, restart, ? help, sound mute, language. Fully keyboard-operable with visible focus rings.

## How it plays

- The visible world height is always 640 units; width follows the viewport aspect, so wider screens see further ahead.
- Each new run has a readable 3–2–1 countdown. Physics, hazards and oil stay frozen until it finishes.
- Thrust burns 6 oil/second while held (previously 15). With no refuel or hits, continuous thrust empties oil at 16.675 active seconds and reaches the ground at 18.342 seconds, plus the initial 3-second countdown. Hovering needs roughly 55% thrust, giving about 30 seconds of oil. **Star sparks** give a little fuel + score; **flame drops** give a lot of fuel. Running out of fuel just means you can't thrust (you fall).
- Hitting a crow or storm costs fuel, knocks you back, and grants ~1.4 s of invulnerability (can't be chained on the same obstacle). Touching the ground ends the run; the ceiling is a soft clamp (no death).
- Below 25% oil, the bar pulses colour and shows a warning symbol and localised text, announces the warning, and plays one cue per threshold crossing (unless muted). Reduced motion keeps the warning static.
- Sparks and flame drops follow a gentler trail in the upper/middle play area, with centres no lower than world y=410 and at least 70 units below the HUD boundary.
- **Score** = distance in metres (units ÷ 10) + sparks × 10. Best score is persisted in `localStorage`.
- World speed and hazard density ramp over ~3 minutes to fixed caps. Generation always leaves a passable corridor marked by the spark trail; hazards sit outside it, and crows are timed to cross the lantern's lane just outside the corridor.

## Layout & accessibility

- Layout is chosen continuously from the viewport aspect ratio (portrait / near-square / wide), re-laid-out live on resize without reload or state loss. The labelled horizontal oil bar stays at the top in every layout, with a fill channel over 20px tall and a visible percentage. HUD labels are at least 18px, key numbers 20px and icon buttons 48×48px. Buttons stay in the corners (never on the centre line) and respect `env(safe-area-inset-*)`.
- Four languages (en, zh-TW, zh-CN, ja), switchable live; browser preferences are tried in order: zh-TW/HK/MO/Hant → Traditional Chinese, zh-CN/SG/Hans or plain zh → Simplified Chinese, ja → Japanese, en → English; unsupported entries are skipped and the fallback is English. A saved explicit choice takes priority. All visible text, aria-labels, and the document title come from `public/config/language/*.json`.
- `prefers-reduced-motion: reduce` disables the lantern tilt and the invulnerability blink (steady dimming instead). The title screen runs the real game, played by a bot, behind the logo.

## Architecture

- `src/game/logic.ts` — pure, deterministic simulation (seedable RNG, fixed 120 Hz timestep). No React, no DOM. Also exports `CorridorBot` used by the title demo and the sim.
- `src/game/renderer.ts` — imperative DOM renderer: entities are recycled through per-kind object pools and positioned each frame with `translate3d`. No canvas, no CSS art.
- `src/ui/GameCanvas.tsx` — owns one running game: the sim, the renderer, the rAF loop, input, and sfx.
- `src/platform/` — asset loader/preload gate, WebAudio, viewport. `src/services/assetResolver.ts` — per-asset URL resolution (`?style` → `commonPath` → `/common/` → public root), sub-path safe.
- `src/config/assets.ts` — the single asset table. `src/config/layout.ts` — layout constants, incl. the fuel-meter channel bounds.

## Onboarding and saved runs

The first run shows three icon-led tips at the bottom: hold to rise, release to fall, and follow sparks to refuel. Input advances the tips; collecting a spark finishes them. They dismiss after 30 seconds, can be skipped, and reopen with the ? button. Completion/dismissal persists in `lantern-rise.coach`.

An active run is saved at most once per simulation second and on pagehide/tab hide. The versioned `lantern-rise.run` snapshot includes oil, movement, distance, entities, countdown and random-generator state. Continue on the title restores it paused; New game, restart and game over discard the previous run. Every restored field is type/range checked, entity arrays and JSON size are capped, and corrupt/unknown data safely resets. Storage failures do not prevent play.

**Back to catalog** appears on the initial Enter screen, title menu and pause dialog in all four languages. These keyboard-accessible links use `href="../"`. Activation synchronously saves the current run through the pagehide save function (bypassing the one-second throttle), clears held input and suspends audio before the browser navigates. Start/title links preserve any saved run; finished runs are never saved. The pause dialog traps Tab and restores focus when resumed. No catalog control appears in the play HUD.

Headless QA includes actual reload recovery, browser language and saved choice, onboarding actions, oil warning audio, reduced motion, all-language HUD/link fit, catalog navigation and synchronous saving, modal focus, and axe checks at 375px and 1440px. It serves `/gamegen-prototypes/lantern-rise/` with the supported `?style=./common/` asset override. Final fix screenshots are written to `../_reports/fix_lantern-rise_*.png`; catalog screenshots are `../_reports/back_lantern-rise_title.png` and `back_lantern-rise_pause.png`. Tests accept `PORT`. Axe uses `/workspace/deploy/node_modules/axe-core/axe.min.js` when available, otherwise the local dev dependency.

### Tuning tools

- `scripts/sim.mjs` — headless difficulty sim. A 20-seed tuning sample with 150ms reaction delay averages 225–232 active seconds (240s cap); perfect play survives four minutes in all three layout samples and at least three minutes at the difficulty cap. This is an endless score game with no win screen.
- `scripts/measure_meter.py` — re-measures `panel_meter.png`'s fill channel (values stored in `src/config/layout.ts`).

## Known gaps

- Audio is original procedural synthesis awaiting human-ear selection (see `AUDIO_NOTES.md`).
- The sim measures win-rate distributions, not game feel; final hand-feel needs real-device testing.
- Backend upload/review and age-rating submission are out of scope here.
