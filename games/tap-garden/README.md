# Tap Garden （芽芽花園 / タップガーデン）

A tap / idle + merge game. Tap the smiling magic pot to collect **dew**, spend dew
on **seeds** that sprout on a random empty plot, **merge** two same-level plants
into the next tier (1 → 9), and let the garden drip dew on its own — all the way to
the level-9 **Golden World Tree**. React 19 + TypeScript + Vite, GameGen "noskin"
platform layout.

## Run / build / test / pack

```bash
npm install
npm run dev            # local dev server
npm run build          # type-check (strict) + production build to dist/
npm run check:i18n     # verify the 4 language files share keys and have no empties
npm run test:headless  # build, serve, drive the real UI in headless Chrome, screenshots → qa/
npm run pack           # build + write tap-garden.zip (contents of dist/ at the zip root)
```

`npm run preview` serves the built `dist/` on port **4173** (used by the headless
test). If the port is busy, find the pid with `ss -ltnp` and `kill <pid>` — do not
pattern-kill.

## How to play

- **Tap the pot** to earn dew (`+tap power` each tap).
- **Buy seed** drops a level-1 plant on a random empty plot (price rises per seed).
- **Tap a plant** to select it, then **tap a matching plant** to merge them into the
  next level. Tap an **empty plot** to move a selected plant. Tap the selection
  again to cancel.
- **Tap power** upgrades how much each tap earns.
- Plants produce dew every second; leave and come back for **offline earnings**
  (capped at 2 h, at 50%).
- Reach the **Golden World Tree** (level 9) for a one-time celebration, then keep
  going endlessly.

### Keyboard

- **Arrow keys** — move focus across the 16 plots
- **Enter / Space** — select / act on the focused plot (and activate any button)
- **T** — tap the pot · **B** — buy a seed · **U** — upgrade tap power
- Every control is a real `<button>` with a localised accessible name; a polite
  live region announces dew and each action.

## Layout, languages, accessibility

- Layout is chosen from the live viewport aspect ratio (portrait / near-square /
  wide) and re-flows on resize without reload or state loss. Portrait is primary.
- Four languages (English, 繁體中文, 简体中文, 日本語), switchable live, persisted and
  validated. Numbers use `Intl.NumberFormat` compact notation (1.2K / 1.2万) so
  there are no hard-coded suffixes.
- WCAG 2.2 AA basics: real buttons, visible focus outlines, ≥4.5:1 text contrast
  (white text on the clay pills carries a dark stroke), `prefers-reduced-motion`
  disables the floating numbers / pop / bob and freezes the title demo, state
  changes are announced, nothing relies on colour alone.

## Persistence

Saved to `localStorage` (key `tap-garden.save`, versioned + validated) every 5 s and
on `visibilitychange` / `pagehide`. Language and mute are stored under their own
namespaced keys. **Reset** (with a confirm dialog) clears the save. No network
calls, analytics, external fonts or third-party scripts.

## Code map

- `src/config/config.ts` — every tunable number (costs, income, caps, seed).
- `src/game/logic.ts` — pure, deterministic game logic (tap/buy/merge/move/upgrade/
  tick/offline) with a seedable RNG; no React/DOM.
- `src/game/save.ts` — validated load/write/clear.
- `src/game/useGarden.ts` — React binding: rAF income loop, sfx, events, autosave,
  offline + celebration.
- `src/game/{GardenScreen,TitleScreen,LoadingScreen}.tsx` and `src/game/components/*`
  — UI. `src/platform/*`, `src/services/*`, `src/i18n/*` — reusable platform code.

## Known gaps

- Balance numbers are first-pass (≈15–25 min to the Golden World Tree) and need
  human play-testing / tuning.
- Audio is placeholder procedural synthesis awaiting a human ear pass (see
  `AUDIO_NOTES.md`).
- `icon_plant_6` ships with a small decorative dew pile baked into the source art;
  it is used as-is (art is not redrawn).
