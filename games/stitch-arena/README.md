# Stitch Arena · 縫偶擂台

An original felt-appliqué arena fighter. Keep your three button lives and knock the other puppet out of bounds. Damage raises **Fray %**, making the next hit launch farther. Four elemental puppets, three stages, six AI levels, a six-match Patch Cup, and Quick Duel use the same deterministic 60 Hz simulation.

```sh
npm install
npm run dev                       # http://localhost:4228
npm run build                     # strict TypeScript + Vite
npm run check:i18n
npm run test:logic
npm run test:sim
PORT=4301 npm run test:headless
PORT=4302 npm run test:title
npm run pack                      # stitch-arena.zip
```

`PORT` changes browser-test preview ports. Run each browser suite on an available port. Chrome is `/usr/bin/google-chrome`; accessibility tests use the installed `axe-core` development dependency. Reports and screenshots are written to `/workspace/gamegen-games/_reports/`. The ZIP has `index.html` and the supplied `poster.png` at its root and contains no source maps.

## Controls and rules

- A/D or ←/→: move. W/↑/Space: jump, then double jump. Hold jump to glide as Gale. S/↓: drop through a platform.
- Z/J or left mouse: punch. X/K or right mouse: elemental spell. C/L: Thread Hook. Hold ↑/↓ to angle an attack. The stage prevents the browser context menu.
- Hook pulls an opponent within 420 units and a forward cone; otherwise it rescues an airborne puppet to a nearby platform edge. A miss has a shorter cooldown.
- P/Esc: pause. All menus and touch buttons support keyboard focus. On touch devices, play in landscape. Drag the left joystick to move; push down to drop through platforms or up to aim (up does not jump). Use the four right-hand buttons: Jump, Punch, Spell and Hook. Jump is the largest button at the bottom of the diamond. Hold controls with multiple fingers; skill buttons show a cooldown ring, seconds and Ready.
- Ember burns, Frost slows, Gale pushes, and Rune launches a falling rock with a ground shockwave. Fire and ice projectiles cancel each other. Rune resists slowing; Frost grips ice.
- Spools appear every 12–18 seconds, refill abilities, and grant a six-second shield against one hit. Night Market scissors give one second of warning. The ice platform begins shrinking after 60 seconds.
- Matches last 120 seconds: more buttons wins, then lower Fray. Exact ties enter sudden death with 200% Fray; the next knockout decides.
- Win Cup matches 2 and 4 to unlock Gale and Rune. Complete all six for the trophy. A loss offers a retry of the current match.

## Saves, language and access

Mid-match snapshots include fighters, stocks, Fray, cooldowns, projectiles, hazards, timer, AI decisions, and RNG state. They save about once per simulated second and on page hide or visibility changes. After reload, choose **Play → Continue match**. Completed matches clear the match snapshot. Cup progress and unlocked characters persist separately. Invalid, oversized or unavailable storage resets safely.

**Back to catalog** is available on the title screen, home menu, and pause dialog. It follows the relative `../` link using native keyboard/click navigation. Before leaving, it releases orientation/fullscreen, synchronously saves current progress and any unfinished match through the page-hide save routine (without the periodic throttle), and suspends audio. Existing snapshots are preserved from title/home; finished matches are never saved.

The first browser language selects Traditional Chinese for zh-TW/HK/MO/Hant, Simplified Chinese for zh-CN/SG/Hans/plain zh, Japanese for ja, and English otherwise. A saved explicit language choice wins. Language changes during play preserve the match. Sound, floating numbers, coach completion and progress are saved under `stitch-arena.*` keys.

The coach introduces joystick movement and the four action buttons on touch devices, and retains keyboard instructions on desktop over the first 30 seconds. Actions advance it; Skip dismisses it; How to play can reopen it. Touch play has a compact top HUD, a separate coach/banner cell and dedicated side columns for the floating joystick and action diamond. No control intersects the canvas. The joystick starts at the first finger and captures that pointer; other fingers can hold attacks and jump simultaneously. Reduced motion disables puppet wobble and ambient effect motion. Dialogs trap focus while open and return it on close. Canvas summaries and combat announcements are localised.

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

## Touch display behavior

Touch capability (coarse pointer or reported touch points), rather than window size, enables the controller layout. Touch matches pause behind a full-screen, localised rotate prompt in portrait; rotating to landscape resumes the exact match. Menus and scrolling dialogs remain available in either orientation. Resizing a keyboard desktop to portrait does not show the prompt. Safe-area padding protects the HUD and controls on all four sides.

Play, Start, Restart and Continue request element fullscreen from the user gesture with hidden navigation, followed by landscape orientation lock when supported. The toolbar arrow button toggles fullscreen; leaving play releases the lock and fullscreen. Unsupported or denied APIs do not interrupt play. iOS Safari generally cannot fullscreen an arbitrary HTML element; orientation lock also depends on browser and fullscreen support. On those platforms, manually rotate and use the normal browser view. The rotate prompt is the fallback; a manifest or installed app is not required.

## Completed validation

The touch revision keeps the production simulation, camera and balance constants unchanged. Verification covers the five touch sizes (844×390, 667×375, 932×430, 568×320 and 1024×768), real CDP touch movement and multi-touch, cooldowns, rotation pause/resume, fullscreen/orientation API support and denial, all four languages, desktop portrait behavior, keyboard/mouse controls, selection guards, save restoration, Cup progression, assets and subdirectory loading. Final results: strict build and package PASS; **108 keys × four languages**; **25/25 logic tests**; **6/6 balance targets** across **864 matches**; **191/191 browser assertions**, including **20 axe audits with zero violations**; **84/84 title/loading assertions** across seven viewports and four languages. The ZIP contains 90 entries with index.html and poster.png at its root; archive integrity, no dist/ wrapper and no sourcemaps are independently checked. Normal desktop and touch runs recorded zero console errors, warnings or failed requests. Exact evidence is recorded in PLAN §8.

Screenshots: `/workspace/gamegen-games/_reports/stitch-arena_touch_{844x390,667x375,932x430}.png`, `stitch-arena_rotate_overlay.png`, and `stitch-arena_touch_coach.png`. Browser reports and logs accompany them. Physical-device feel and human audio listening review remain outstanding.


Catalog navigation validation: **109 keys × four languages; 25/25 logic; 6/6 balance targets (864 matches); 311/311 browser assertions, including 24 axe audits with zero violations; 84/84 title assertions at all seven viewports; build/pack and 5/5 archive checks PASS**. The title and pause screenshots are `_reports/back_stitch-arena_title.png` and `_reports/back_stitch-arena_pause.png`; both were visually inspected. Local validation logs are in `qa/back-catalog/`.
