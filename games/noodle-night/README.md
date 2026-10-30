# Noodle Night（夜市麵攤）

A one-handed night-market noodle game built with React 19, TypeScript and Vite.
Read the customer's order icons, add matching toppings, then **Serve**. Three wrong
orders or impatient customers close the stall. Empty bowls and incomplete subsets
of the order give a gentle reminder and preserve lives, toppings and combo. An
extra, unrequested topping still counts as a mistake.

## Run and check

```bash
npm install
npm run dev -- --port 4331 --strictPort
npm run build
npm run check:i18n
npm run test:logic
PORT=4331 npm run test:headless
PORT=4331 npm run test:title
npm run pack
```

Browser scripts start and stop their own preview server; run them sequentially.
They need Chrome at `/usr/bin/google-chrome`. The headless suite uses the shared
axe bundle at `/workspace/deploy/node_modules/axe-core/axe.min.js` when available
(or the local `axe-core` dev dependency), checks title,
play, help/pause and results at 375 and 1440 pixels, plays a real ×10 streak,
reloads a partial bowl, checks four-language layouts and browser language mapping,
and loads from `/noodle-night/` to exercise ZIP subpath hosting. Catalog checks
cover all four languages, native parent-directory navigation, synchronous exit
saves, keyboard focus and pause layouts at the seven required viewport sizes. The title suite
checks title art/copy bounding boxes across portrait, short landscape and desktop
viewports, including missing artwork. Screenshots are in `qa/` and
`../_reports/fix_noodle-night_*.png`; `npm run pack` builds `noodle-night.zip`.

## Controls and onboarding

- Touch/pointer: select a customer's order bubble, toggle toppings, tap **Serve**.
  Tap the bowl to clear it. Serve sits directly below the toppings in every layout.
- Keyboard: `1`–`6` toggle toppings, `Enter`/`Space` Serve when a control is not
  focused, `C`/`Backspace` clear, `←`/`→` select a customer, `Tab` moves focus.
- A first-run, nonblocking three-step illustrated coach advances on selection,
  topping input and a successful Serve. **Skip** dismisses it; **?** reopens it.
  The pause button shows the same three illustrations and a compact key reference.
  Backgrounding the tab pauses the run. Reduced motion disables topping animation
  and chef animation; all state changes remain visible.

The start gate, title menu (including Continue / New game), and pause/help dialog
include **Back to catalog** (`返回目錄` / `返回目录` / `カタログに戻る`). The native
`href="../"` link returns to the parent catalog. It synchronously calls the existing
run saver before navigation, preserving partial bowls and customer progress without
saving the title demo or a finished run, then suspends audio. It is absent from the
play HUD. The pause dialog traps Tab among its controls and restores focus to Pause
when resumed. Catalog screenshots are `../_reports/back_noodle-night_title.png`
and `../_reports/back_noodle-night_pause.png`.

## Rules and persistence

- Patience, indexed by successful serves: **48, 40, 32, 24 seconds**, then
  `max(7, 16 − 0.7 × (served − 4))`. The first customer gets three times the former
  16 seconds; retrying before a successful Serve retains the same grace period.
  Orders grow from 1–2 to 1–3 toppings at 4 served, then 2–4 at 8. The second seat
  opens at 6 served.
- Combo multiplier is `min(10, 1 + 0.5 × (streak − 1))`, starting at ×1 and reaching
  **×10 on the 19th consecutive correct Serve**. Each order earns
  `round((10 × toppings + round(10 × remainingPatience / maxPatience)) × multiplier)`.
  Both streak and multiplier appear in the HUD. Wrong toppings and timeouts reset
  the streak. Both ways of ending a run clear customers, bowls and pending spawns.
- Default language follows the first supported entry in `navigator.languages`:
  `zh-TW/HK/MO/Hant* → zh-tw`, `zh-CN/SG/Hans*/zh → zh-cn`, `ja* → ja`, `en* → en`;
  no supported entry falls back to English. A valid saved language selection in
  `noodle_night_lang` takes precedence. All four dictionaries share identical keys;
  Serve instructions interpolate the exact button label.
- In-progress runs use `noodle_night_run` (version 1, 16 KB limit). Known fields,
  numeric bounds, enums, toppings, customer IDs/seats and selection are validated
  before reconstruction. Save after actions, once per second, and on pagehide or
  visibilitychange. Reload returns to the preload gate, then offers **Continue /
  New game**. Offline time does not drain patience. New game replaces the previous
  run; game over clears it. Corrupt, unsupported or oversized saves reset safely.
  All storage access tolerates unavailable/full localStorage.
- Best score uses `noodle_night_best`, appears on title and results, and gets a
  **New best** badge on a record result. First-run coach uses
  `noodle_night_coach_v1`. Clear these keys to reset the corresponding preferences.
- Supplied art is reused directly. Local configured asset roots resolve relative
  to the game base, so the ZIP also works below a subpath. Panel geometry is in
  `src/config/layout.ts`. Audio provenance is in `AUDIO_NOTES.md`.

## Known gaps

Chinese/Japanese wording awaits a native-speaker pass. Procedural audio awaits a
human ear-selection pass. Headless checks do not replace physical-device testing.
