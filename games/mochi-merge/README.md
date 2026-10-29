# Mochi Merge (麻糬合成)

Slide the whole 4×4 board; equal mochi collide and merge into the next of nine
tiers (plain → sakura → matcha → bean → strawberry → mango → taro → star →
dragon). Reach the golden Dragon mochi to win — then keep going for a higher
score. Casual, one-handed, portrait-first. React 19 + TypeScript + Vite.

## Run

```bash
npm install      # already done in this environment
npm run dev      # dev server
npm run build    # type-check (tsc) + production build into dist/
npm run preview  # serve the production build on :4173
```

The build works from any sub-path (Vite `base: './'`). Assets resolve per-asset
in the order `?style=` → `commonPath` → `/common/` → local, and a single failed
asset never breaks the game (image → placeholder, audio → silent, json →
English).

## Checks

```bash
npm run check:i18n     # all 4 language files share the same non-empty keys
npm run test:headless  # Puppeteer QA (builds, serves, plays, resizes); writes qa/
npm run pack           # builds, then writes mochi-merge.zip (dist contents at root)
```

`test:headless` verifies: zero console errors/warnings, zero failed requests,
the loading gate + enter, a running title demo, real gameplay reaching a result
screen, all four languages with no text overflow, resize mid-game without reload
or state loss, and a blocked-image fallback. Screenshots land in `qa/`.

## Controls

- **Arrow keys** or **W A S D** — slide up / left / down / right.
- **Swipe** on the board (touch/pointer), min 24px, dominant axis wins.
- On-screen buttons: **restart**, **sound** (mute toggle, persisted),
  **language** (en / 繁中 / 简中 / 日本語, live switch, persisted).

Accessibility: every control is a real focusable `<button>` with a localised
name and a visible focus ring; moves are announced through an `aria-live`
region and the board has a hidden text summary; `prefers-reduced-motion` turns
off slides/pops and the title demo (state still changes visibly); touch targets
≥ 44px; four languages drive `<html lang>` and the document title.

## Layout & art

- **Portrait** (primary): score/best pills on top, board centred, buttons below.
- **Near-square / wide**: board left-centre, pills + buttons stacked on the
  right side (never on the vertical centre line).

The board frame (`panel_board.png`) and its cell slots (`panel_cell.png`) are
aligned using the frame's **measured** inner field — see
`scripts/measure-board.py`, whose output is baked into `src/config/layout.ts`.

## Scoring

A merge that produces a tile of tier *n* awards `2^n` points (tier 2 = 4 … tier
9 = 512). After any board-changing move, one tile spawns: tier 1 at 90%, tier 2
at 10%. All of this lives in the pure, seedable `src/game/logic.ts`, shared by
the UI, the title bot (`src/game/bot.ts`), and the headless test.

## Known gaps / notes

- Audio is procedural placeholder material awaiting human-ear selection
  (`AUDIO_NOTES.md`). `sfx_spawn.mp3` was deleted (spawns are silent).
- Best score persists in `localStorage` (validated); there is no undo, by design.
- No network calls, analytics, third-party scripts, or external fonts.
