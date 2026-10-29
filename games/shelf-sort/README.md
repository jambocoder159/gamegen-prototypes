# Shelf Sort（貨架理貨）

A cozy sorting puzzle. Each shelf has three slots; lift a goods item and drop it
on an empty slot (any shelf). Fill a shelf with three matching goods and it
clears. Clear every shelf to win, in as few moves as possible for three stars.
React 19 + TypeScript + Vite, built to the GameGen HTML-ZIP platform standard
(noskin assets under `public/common/`, four languages, sub-path safe).

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck (tsc) + production build to dist/
npm run preview    # serve the build on http://localhost:4173
```

## Test / pack

```bash
npm run check:i18n     # all four language files share keys, none empty
npm run test:headless  # builds, serves on 4173, drives the real UI in Chrome
npm run pack           # builds, writes shelf-sort.zip (dist contents at the root)
```

`test:headless` needs `/usr/bin/google-chrome`. Free port 4173 first if a preview
is already bound to it (`--strictPort`): `lsof -ti tcp:4173 | xargs -r kill`.

## How to play / keys

- **Tap** a goods item to lift it, then **tap an empty slot** to place it. Tap the
  lifted item again to put it back down. Tapping another item swaps the selection.
- **Arrow keys** move focus between slots; **Enter / Space** lift and place;
  **Z** undoes a move (unlimited); **R** restarts the level.
- Controls row: Undo · Restart · Levels · Sound · Language.
- 12 levels, deterministically generated and guaranteed solvable; par (for the
  star rating) is the solver's solution length. Progress (unlocked levels, best
  stars) is saved in `localStorage` and validated on load.

## Structure

- `src/game/logic.ts` — pure rules (board, moves, clears, win, star rating).
- `src/game/solver.ts` — deterministic greedy solver (generator validity + par,
  title demo, test reference).
- `src/game/levels.ts` — seeded level generator (reject-until-solvable).
- `src/game/progress.ts` — validated `localStorage` progress.
- `src/game/layout.ts` — shelf geometry + responsive column/size fit.
- `src/platform/`, `src/services/`, `src/i18n/`, `src/config/` — reusable
  GameGen infrastructure (loader, audio, asset resolver, i18n).

## Known gaps

- Audio is placeholder procedural synthesis awaiting a human ear pass
  (see `AUDIO_NOTES.md`).
- Level difficulty curve is deterministic but not hand-tuned; par comes from the
  greedy solver, so three stars is achievable but not necessarily optimal play.
