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
npm run test:headless  # build, serve, drive a real browser, assert QA, write screenshots to qa/
npm run pack           # build then write lantern-rise.zip (contents of dist/ at the zip root)
```

`npm run test:headless` needs Chrome at `/usr/bin/google-chrome`.

## Controls / keys

- **Hold** anywhere on the play field (pointer or touch, multitouch-safe) to thrust up; **release** to fall.
- **Space**, **W**, or **↑** also thrust.
- **P** or **Esc** toggles pause.
- Buttons (top corners): pause/resume, restart, sound mute, language. Fully keyboard-operable with visible focus rings.

## How it plays

- The visible world height is always 640 units; width follows the viewport aspect, so wider screens see further ahead.
- Thrust burns fuel (drains while held). **Star sparks** give a little fuel + score; **flame drops** give a lot of fuel. Running out of fuel just means you can't thrust (you fall).
- Hitting a crow or storm costs fuel, knocks you back, and grants ~1.4 s of invulnerability (can't be chained on the same obstacle). Touching the ground ends the run; the ceiling is a soft clamp (no death).
- **Score** = distance in metres (units ÷ 10) + sparks × 10. Best score is persisted in `localStorage`.
- World speed and hazard density ramp over ~3 minutes to fixed caps. Generation always leaves a passable corridor marked by the spark trail; hazards sit outside it, and crows are timed to cross the lantern's lane just outside the corridor.

## Layout & accessibility

- Layout is chosen continuously from the viewport aspect ratio (portrait / near-square / wide), re-laid-out live on resize without reload or state loss. In wide layouts the fuel bar stands vertically on the left; otherwise it sits at the top. Buttons stay in the corners (never on the centre line) and respect `env(safe-area-inset-*)`.
- Four languages (en, zh-TW, zh-CN, ja), switchable live; all visible text, aria-labels, and the document title come from `public/config/language/*.json`.
- `prefers-reduced-motion: reduce` disables the lantern tilt and the invulnerability blink (steady dimming instead). The title screen runs the real game, played by a bot, behind the logo.

## Architecture

- `src/game/logic.ts` — pure, deterministic simulation (seedable RNG, fixed 120 Hz timestep). No React, no DOM. Also exports `CorridorBot` used by the title demo and the sim.
- `src/game/renderer.ts` — imperative DOM renderer: entities are recycled through per-kind object pools and positioned each frame with `translate3d`. No canvas, no CSS art.
- `src/ui/GameCanvas.tsx` — owns one running game: the sim, the renderer, the rAF loop, input, and sfx.
- `src/platform/` — asset loader/preload gate, WebAudio, viewport. `src/services/assetResolver.ts` — per-asset URL resolution (`?style` → `commonPath` → `/common/` → public root), sub-path safe.
- `src/config/assets.ts` — the single asset table. `src/config/layout.ts` — layout constants, incl. the fuel-meter channel bounds.

### Tuning tools

- `scripts/sim.mjs` — headless difficulty sim. A corridor bot with 150 ms reaction delay averages ~70 s; perfect play survives 3+ minutes, including at the difficulty cap.
- `scripts/measure_meter.py` — re-measures `panel_meter.png`'s fill channel (values stored in `src/config/layout.ts`).

## Known gaps

- Audio is original procedural synthesis awaiting human-ear selection (see `AUDIO_NOTES.md`).
- The sim measures win-rate distributions, not game feel; final hand-feel needs real-device testing.
- Backend upload/review and age-rating submission are out of scope here.
