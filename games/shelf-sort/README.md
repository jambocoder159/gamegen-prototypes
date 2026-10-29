# Shelf Sort（貨架理貨）

A React 19 + TypeScript + Vite sorting puzzle: lift an item, place it in an empty
slot, and clear shelves of three matching goods. Twelve seeded, solvable levels;
four languages; sub-path-safe assets; no external services.

## Run and verify

```bash
npm install
npm run dev -- --port 4224 --strictPort
npm run build
npm run check:i18n
npm run test:logic
PORT=4224 npm run test:headless
PORT=4224 npm run test:title
npm run pack
```

Browser tests use `/usr/bin/google-chrome`, start and stop their own preview on
port 4224 (`PORT` overrides it), and must run sequentially on that port. Headless
QA checks gameplay, recovery, onboarding, languages, invalid input, responsive
layout and axe WCAG violations on the gate/title/play/menu/dialogs at 375 and
1440px. Title QA checks artwork/text separation across desktop and phone sizes.
Final fix screenshots are in `../_reports/fix_shelf-sort_*.png`.
`pack` writes `shelf-sort.zip`, with `index.html` and `poster.png` at its root.

## Play

- Tap an item, then an empty slot. Tap the lifted item again to cancel.
  An occupied destination preserves your selection and move count, with a
  visible rejection mark, a short screen-reader message and quiet sound.
- Arrow keys move focus; Enter/Space lift/place; Z undoes; R restarts.
- The first-run, three-step on-screen coach follows your actions. Skip dismisses
  it; the **?** button reopens it. It occupies a separate region from the shelves.
- Undo is unlimited. Restart resets the current level. Levels opens unlocked
  levels; sound and language controls apply immediately.
- Levels 2–4 use exact solver optima of 5/7/5 moves, with three-star budgets of
  6/8/6 and two-star budgets of 9/11/9. Other levels retain greedy-solver par.

## Language and storage

A validated saved language choice takes priority. Otherwise the first supported
entry in `navigator.languages` wins: zh-TW/HK/MO or zh-Hant → Traditional Chinese;
zh-CN/SG/Hans or plain zh → Simplified Chinese; ja → Japanese; en → English.
Unsupported entries are skipped; English is the fallback. Language changes do
not reset play.

Runs save after moves, undo and selection changes, and on pagehide/visibility
changes. After reload, **Continue** restores the level, board, lifted item, move
count and undo history; **New game** starts level 1. Restart, a win and New game
clear the run. Storage uses a versioned, bounded move log (5,000 moves / 200 KB),
replayed and checked field by field; invalid data safely resets. Storage errors
never interrupt play. Best stars, unlocked levels and coach dismissal are also
saved locally. The preload/Enter audio gate remains required after reload.

## Structure and limits

`src/game/logic.ts` contains rules; `solver.ts` supplies the fast greedy solver;
`levels.ts` generates boards and holds star budgets; `run.ts` validates recovery;
`scripts/optimal-solver.mjs` proves the small-level optima by exhaustive IDA*.
`test:logic` checks legal solutions, complete undo, all rating boundaries, browser
language mappings, storage round trips and corrupt/disabled storage.

Audio is original placeholder synthesis awaiting a human ear pass (see
`AUDIO_NOTES.md`). Human difficulty tuning and physical-device checks remain
outside automated QA. Games exceeding the recovery cap continue normally but
are no longer saved until restarted or undone below the cap.
