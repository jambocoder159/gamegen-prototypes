# Match Hero Tower · 消消勇者塔

A pixel-art match-3 idle battler built with React 19, TypeScript and Vite. Your hero attacks, earns gold and builds SP automatically. Matching gems accelerates the climb; every fifth floor is a boss.

```sh
npm install
npm run dev                  # http://localhost:4227
npm run build                # strict TypeScript + production build
npm run check:i18n
npm run test:logic
npm run test:sim
PORT=4228 npm run test:headless
PORT=4228 npm run test:title  # run browser suites sequentially on the same port
npm run pack                 # match-hero.zip, dist contents at ZIP root
```

Browser tests require `/usr/bin/google-chrome`, puppeteer-core and axe-core at `/workspace/deploy/node_modules/axe-core/axe.min.js`. Build before browser tests. `PORT` defaults to 4227; use an available port without stopping another game's server. Reports and screenshots go to `/workspace/gamegen-games/_reports/`.

## Play

- Tap two adjacent gems, or swipe/drag between them, to make a line of three. Invalid swaps cost nothing. Four in a line creates a star; swapping a star blasts a 3×3 area. Cascades increase the combo multiplier; an unplayable board reshuffles automatically.
- Sword and flame gems deal damage (flame also burns); crystal gives SP, heart heals, coin earns gold. Every cleared gem also deals damage and gives SP.
- Spend SP on Fireball (30 SP, 6× ATK), Heal (40 SP, 40% HP), or Haste (25 SP, double attack speed for eight seconds). Buttons show energy/cooldown reasons.
- Open the arrow icon to buy permanent ATK, speed, crit, HP, match power, gold find and focus upgrades. Choose ×1 or Max.
- Defeat retreats to the start of the current five-floor section and restores HP. Gold and upgrades survive. Continue from the retreat dialog.
- Arrow keys move board focus; Enter/Space selects and swaps; Escape cancels selection or closes a dialog; 1/2/3 casts skills; P pauses. Dialogs contain keyboard focus and restore it when closed.

The coach appears for the first 30 seconds, advances with actions and can be skipped or reopened with Help. Both hero and match stats remain visible. Settings control sound, language and floating damage numbers; reduced-motion preferences disable animations.

## Saves and languages

Versioned, size-limited, validated localStorage saves retain the board, gold, upgrades, floor/wave, enemy and hero HP, SP, cooldowns and best floor. Runs save after actions, approximately once per second and on page hide. The title offers Continue/New adventure. Invalid data resets safely; unavailable storage does not stop play. Sound, coach completion, numbers and selected language are stored separately.

The browser language list selects Traditional Chinese for zh-TW/HK/MO/Hant, Simplified Chinese for zh-CN/SG/Hans/plain zh, Japanese for ja, and English otherwise. A saved explicit choice takes priority. All four languages can be selected during play.

`?floor=N` accepts integer floors 1–100 for an isolated debug run (for example `?floor=5` for the dragon). Debug runs never write the real run save. Remove the parameter to return to the saved adventure.

## Balance

The deterministic simulation uses the production rules and seed 42. Auto-only buys upgrades but never matches or casts skills. The standard matcher clears an average 3.2 gems every three seconds, buys upgrades and uses skills. Times are minutes to enter each floor; damage shares and gold/min cover the run through entry to floor 20.

| Player | Floor 5 | Floor 10 | Floor 15 | Floor 20 | Auto / match damage | Gold/min | Retreats |
|---|---:|---:|---:|---:|---:|---:|---:|
| Auto only | 7.06 | 20.31 | 42.78 | 95.22 | 100% / 0% | 341.7 | 1 |
| Standard matcher | 2.66 | 6.24 | 10.98 | 18.64 | 57.1% / 42.9% | 5172.9 | 0 |

All balance targets pass: standard floor 10 in 6–10 minutes, auto floor 10 at least 40% slower, standard floor 20 within 30 minutes, and both players advance. Constants and rationale are in PLAN §3 and `src/game/config.ts`.

## Implementation and assets

`src/game/logic.ts` contains deterministic board, combat, skills, upgrades, formatting and save validation. The sim and logic tests import that same module. `src/game/` owns the game UI; `src/platform/`, `src/services/`, `src/i18n/` and the JSON configuration retain the reusable loading, audio, layout and asset-resolution layer. Assets resolve relative to the hosted page and support per-asset style overrides/fallbacks.

Art uses the supplied final pixel sprites without repainting. The supplied UI atlas contains the logo and icons rather than separate `logo_base.png`/`icon_*.png` files; CSS displays those unchanged regions. `public/poster.png` is a 9:16 capture of the title. Audio is original procedural chiptune awaiting human listening review; see AUDIO_NOTES.md.

## Verified checks

Production build, four-language key validation (78 keys each), 10/10 logic checks, all balance targets, 76/76 browser checks, 112/112 title/loading/resume layout checks, and packaging passed. Axe reported zero violations for title, play, upgrades and defeat at both 375px and 1440px. Browser coverage includes saved-run restoration, coach progression/reopen/skip, both input gestures and keyboard swaps, skills, upgrades, retreat, boss progression, debug-save isolation, missing-image fallback and a subdirectory mount. Portrait, small-phone, landscape, desktop, coach and upgrades captures were visually reviewed. The ZIP contains index.html and poster.png at its root.
