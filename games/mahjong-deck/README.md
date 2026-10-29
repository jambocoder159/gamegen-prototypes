# Mahjong Deck

A one-handed HTML5 game: mahjong-solitaire pair matching crossed with a
roguelike card deck. Clear five growing tile pyramids by matching pairs of free
tiles; after each stage, pick one of three ability cards to add to your hand.
React 19 + TypeScript + Vite, GameGen "noskin" platform.

## How to play

- Tap a **free** tile, then a second free tile of the **same** face → the pair
  clears and scores `100 × combo`. A combo rises by one for each match made
  within 2.5 s of the last (max ×5); the combo pill shows when active.
- A tile is **playable** when nothing covers it from above **and** at least one
  side (left or right) has no tile touching it. Blocked tiles are clearly dimmed;
  the cover and side rules are computed from the exact rectangles the tiles are
  drawn as (`src/game/geometry.ts`), so what you see is what the rules say.
- Tapping a **blocked** tile costs nothing — it just jiggles and shows a short
  notice saying whether it is covered or blocked on both sides.
- Matching two **different** playable tiles costs a heart (start 3, max 5). At 0
  hearts the run ends.
- Clear a stack to get a reward: choose 1 of 3 ability cards. Clear all five
  stacks to win. Stage-clear bonus = `hearts × 200`.
- If no matching pair is reachable, the board auto-reshuffles — free if you hold
  a Shuffle card, otherwise for one heart.

### Ability cards (hand holds up to 4 distinct types; start: Hint ×1, Shuffle ×1)

| Card | Effect |
|---|---|
| Hint | Highlight a matching pair |
| Shuffle | Reshuffle remaining tiles (stays solvable) |
| Undo | Put the last removed pair back |
| Wild | Next match may pair any two free tiles |
| Heal | +1 heart (max 5) |
| Combo | Next 3 matches score ×2 |

### Keyboard

- **Arrow keys** — move focus between free tiles (nearest in that direction)
- **Enter / Space** — select the focused tile
- **1–4** — play the matching hand-card slot
- **Z** — Undo card · **H** — Hint card · **S** — Shuffle card

All controls are real buttons with localised accessible names; the keys are also
documented in the in-game help text (screen-reader only), in all four languages.

## Run / test / pack

```bash
npm install
npm run dev            # local dev server
npm run build          # tsc --noEmit + vite build (emits dist/ incl. poster.png)
npm run check:i18n     # verify en / zh-TW / zh-CN / ja have identical, non-empty keys
npm run test:logic     # node unit test: all 5 layouts + deal generation (no browser)
npm run test:headless  # build + vite preview + puppeteer QA (also runs test:logic)
npm run pack           # build + write mahjong-deck.zip (dist contents at zip root)
```

`test:headless` drives the real UI (clicking tile buttons, reading their data
attributes) and writes screenshots to `qa/`. The preview port is **4174**. For
each of the five stacks it independently recomputes, from the real DOM bounding
boxes, which tiles are visually covered and side-blocked and confirms the game's
playable/blocked flags, brightness and click behaviour match the picture.

### `?stage=N` (QA only)

Appending `?stage=N` (N = 1–5) to the URL starts a fresh run on that stack, for
testing deeper stages without playing through. It is validated to 1–5 (anything
else starts at stage 1) and never touches saved data or the best score.

## Structure

- `src/game/logic.ts` — pure, deterministic rules: free-tile test, reverse-
  solvable deal generation, shuffle, match finding (seeded `mulberry32`).
- `src/game/layouts.ts` — the five stage layouts (tile counts 24/36/48/60/72,
  3–4 layers), as lists of `{x, y, z}` on a half-cell grid.
- `src/game/cards.ts` — the six ability cards and hand/reward helpers.
- `src/game/useGame.ts` — React state machine (playing / reward / victory /
  defeat), scoring, combo timing, card effects, stuck detection.
- `src/game/geometry.ts` — the single shared tile geometry (drawn rectangles +
  cover/side predicates) used by both the logic and BoardView, so rules == picture.
- `src/game/components/BoardView.tsx` — absolutely-positioned tile buttons scaled
  by a CSS transform to fit the available space; depth from z-index + drop-shadow.
- `src/platform/*`, `src/services/*`, `src/i18n/*` — reusable GameGen platform
  infrastructure (preload gate, audio, layout, asset resolver, i18n).

## Known gaps

- Audio is placeholder procedural synthesis awaiting human-ear selection (see
  `AUDIO_NOTES.md`).
- Deals are seeded per stage (deterministic), so a fresh run plays the same five
  boards each time; the reward offers are likewise seeded.
- `axe-core` is not installed and there is no network in this environment, so the
  automated accessibility audit could not be run here; the WCAG 2.2 AA practices
  it checks (real buttons with names, ≥3px focus outlines, ≥4.5:1 text contrast
  on solid plates/chips, aria-live announcements, full keyboard play, `<html
  lang>`) are implemented and were verified manually.
