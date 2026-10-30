# Stitch Arena · 縫偶擂台

An original felt-appliqué arena fighter. Keep your three button lives and knock the other puppet out of bounds. Damage raises **Fray %**, making the next hit launch farther. Four elemental puppets, three stages, six AI levels, a six-match Patch Cup, and Quick Duel use the same deterministic 60 Hz simulation.

```sh
npm install
npm run dev                       # http://localhost:4228
npm run build                     # strict TypeScript + Vite
npm run check:i18n
npm run test:logic
npm run test:sim
PORT=4281 npm run test:headless
PORT=4282 npm run test:title
npm run pack                      # stitch-arena.zip
```

`PORT` changes browser-test preview ports. Run each browser suite on an available port. Chrome is `/usr/bin/google-chrome`; accessibility tests load the local axe-core file at `/workspace/deploy/node_modules/axe-core/axe.min.js`. Reports and screenshots are written to `/workspace/gamegen-games/_reports/`. The ZIP has `index.html` and the supplied `poster.png` at its root and contains no source maps.

## Controls and rules

- A/D or ←/→: move. W/↑/Space: jump, then double jump. Hold jump to glide as Gale. S/↓: drop through a platform.
- Z/J or left mouse: punch. X/K or right mouse: elemental spell. C/L: Thread Hook. Hold ↑/↓ to angle an attack. The stage prevents the browser context menu.
- Hook pulls an opponent within 420 units and a forward cone; otherwise it rescues an airborne puppet to a nearby platform edge. A miss has a shorter cooldown.
- P/Esc: pause. All menus and touch buttons support keyboard focus. On touch devices, hold movement and attacks simultaneously; buttons show cooldown seconds and readiness.
- Ember burns, Frost slows, Gale pushes, and Rune launches a falling rock with a ground shockwave. Fire and ice projectiles cancel each other. Rune resists slowing; Frost grips ice.
- Spools appear every 12–18 seconds, refill abilities, and grant a six-second shield against one hit. Night Market scissors give one second of warning. The ice platform begins shrinking after 60 seconds.
- Matches last 120 seconds: more buttons wins, then lower Fray. Exact ties enter sudden death with 200% Fray; the next knockout decides.
- Win Cup matches 2 and 4 to unlock Gale and Rune. Complete all six for the trophy. A loss offers a retry of the current match.

## Saves, language and access

Mid-match snapshots include fighters, stocks, Fray, cooldowns, projectiles, hazards, timer, AI decisions, and RNG state. They save about once per simulated second and on page hide or visibility changes. After reload, choose **Play → Continue match**. Completed matches clear the match snapshot. Cup progress and unlocked characters persist separately. Invalid, oversized or unavailable storage resets safely.

The first browser language selects Traditional Chinese for zh-TW/HK/MO/Hant, Simplified Chinese for zh-CN/SG/Hans/plain zh, Japanese for ja, and English otherwise. A saved explicit language choice wins. Language changes during play preserve the match. Sound, floating numbers, coach completion and progress are saved under `stitch-arena.*` keys.

The coach introduces movement, double jumping, punching, spells and recovery over the first 30 seconds. Actions advance it; Skip dismisses it; How to play can reopen it. HUD and banner occupy separate rows from the canvas. Short landscape layouts put real touch controls at the sides. Reduced motion disables puppet wobble and ambient effect motion. Dialogs trap focus while open and return it on close. Canvas summaries and combat announcements are localised.

## Testing modes

The following explicit query flags run isolated practice sessions and never write or delete real match/progression saves:

- `?debug=input`: normal-speed keyboard/pointer QA, with a read-only `window.__gg` snapshot.
- `?debug=bot`: both sides use production AI, 12× simulation speed, opponent starts with one button.
- `?debug=cup`: the same six Cup matches and unlock routing, 12× speed, level-6 player bot against level-1 opponents starting with one button and 250% Fray.

Only development builds or these flags expose the read-only snapshot. Normal production play has no test interface. Debug victories are practice results, not balance measurements. `test:sim` runs unmodified production rules with three buttons, no handicaps, and fixed seeds.

## Balance and verification

Level-4 round-robin, 288 matches (16 per pairing per stage):

| Ember | Frost | Gale | Rune | Mean duration | Timeouts |
|---|---|---|---|---|---|
| 55.56% | 49.31% | 38.19% | 56.94% | 46.18s | 0% |

Novice win rates against L1→L6 (96 matches each): **84.38%, 54.17%, 16.67%, 1.04%, 0%, 0%**. All six balance targets pass.

See PLAN §8 for the reproducible round-robin and novice tables, final constants and exact checks. The simulation report is `/workspace/gamegen-games/_reports/stitch-arena_balance.json`.

Known limits: synthesized audio still needs human listening review; touchscreen feel and AI entertainment value need human playtesting. Automated balance establishes the stated statistical targets, not human difficulty ratings. The supplied artwork is used unchanged; absent images use plain placeholders and absent audio stays silent.

## Completed validation

Final runs: strict build PASS; four dictionaries × 97 non-empty keys PASS; **25/25 logic tests**; **6/6 balance targets**; **133/133 browser assertions** including **zero axe violations across 16 screen/width combinations**; **84/84 title/loading assertions**. Normal application tests recorded zero console errors, warnings, or failed requests. Portrait, landscape, desktop, coach, spell, KO, pause, selection, result, unlock and trophy captures were inspected.

| Requested work | Status and evidence |
|---|---|
| 1. Config, simulation, AI, snapshots | DONE — 25 deterministic logic tests; physics, spells, shields, hazards, timer, camera, corrupt saves and progression. |
| 2. Balance | DONE — 288 round-robin + 576 novice matches, all six targets pass; tables above and PLAN §8. |
| 3. UI and access | DONE — menu/select/Cup/result/trophy, world-only canvas, responsive HUD, touch/keyboard/mouse, dialogs; geometry and 16 axe checks pass. Dialogs hide the paused canvas to keep visible controls separate from the world. |
| 4. Loading and title | DONE — real asset progress, one Play gesture, live silent AI demo, 84 layout assertions across seven sizes and four languages. |
| 5. Sound | DONE — all 19 supplied files mapped, predecoded buffers, persisted mute, hidden-tab suspension; human listening review pending. |
| 6. Four languages | DONE — 97 keys each; browser mapping, saved preference, live language cycling, translated layout matrices. |
| 7. Saves and coach / C1–C5 | DONE — first-run action coach, browser language, exact reload restoration, art/text separation, large HUD and buttons verified. |
| 8. Browser QA | DONE — 133 assertions, 16 zero-violation axe runs, ten-size resize matrix, touch holds, selection guards, short-click buffering, fallback and subdirectory checks. |
| 9. Docs and package | DONE — updated README, PLAN, audio map, complete manifest; ZIP root/layout independently verified. |

No required implementation item is left partial. Human audio selection, physical-device touch feel and subjective AI playtesting remain outside the automated results above.
