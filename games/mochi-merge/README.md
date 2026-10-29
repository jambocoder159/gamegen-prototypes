# Mochi Merge (麻糬合成)

Slide the 4×4 board to combine matching numbered mochi. Reach tier 9, the
Golden Dragon, then keep playing for a higher score. React 19 + TypeScript + Vite.

```bash
npm install
npm run dev -- --port 4221 --strictPort
npm run build
PORT=4221 npm run test:headless
PORT=4221 npm run test:title
npm run check:i18n
npm run test:logic
npm run pack
```

The package is `mochi-merge.zip`, with `index.html` and `poster.png` at its root.
The build uses relative URLs and works below a subfolder; the headless test
serves it at `/mochi-merge/`. No deployment or network services are required.

After real media preloading, the title appears automatically. Its single Play
button (click, Enter or Space) unlocks audio and starts the game. A saved run
changes this to **Continue**, with **New game** alongside it. The title bot uses
the same game logic, with art and title text in separate layout regions.

Use **arrows / WASD**, or **swipe** at least 24px on the board. Restart, sound,
language and **?** help are available on screen. First-run coaching appears
beside/below the board, advances after sliding and merging, and can be skipped
or reopened with **?**. Every tile keeps its original art and has a high-contrast
number. The HUD shows score, best and **Goal: Golden Dragon**, with the highest
tier reached out of 9. Results show the highest tier's name, number and icon,
final score and best score.

Language defaults to the first supported entry in `navigator.languages`:
`zh-TW`, `zh-HK`, `zh-MO` and `zh-Hant*` map to Traditional Chinese;
`zh-CN`, `zh-SG`, `zh-Hans*` and plain `zh` map to Simplified Chinese;
`ja*` maps to Japanese and `en*` to English. Unmatched lists fall back to
English. A validated saved selection overrides the browser. All four languages
have identical keys and switch live without resetting play.

The versioned `mochi.run` save stores the board, score, best, tile IDs, RNG state,
move count and keep-going flag after each changed move and on pagehide/visibility
changes. Validation rejects malformed, oversized, duplicate or inconsistent data;
storage denial or quota errors leave play usable. Game over and the win banner
clear the old save; choosing Keep going saves the continued run. New game and
Restart replace it with a fresh run. Best score and mute choice persist separately.

All controls are keyboard accessible with visible focus outlines and targets
at least 48px. HUD labels are at least 18px and numbers 28px. The board has a
screen-reader summary and polite move announcements. Reduced motion stops the
title demo and tile animations. Layout follows the viewport, respects safe areas,
and wraps side controls on narrow tablet layouts.

QA covers coaching, reload/continuation, invalid saves, browser language defaults,
all translations, input/audio unlocking, goal and result data, reduced motion,
image fallback, zero console/request errors, and resize/state preservation.
`test:title` checks art/text non-overlap and normal/Continue title layouts on
portrait, landscape and desktop. Headless axe checks title, play, language menu,
win and result at 375px and 1440px (zero violations required). Screenshots are
written to `qa/` and `../_reports/fix_mochi-merge_*.png`.

Scoring: merging into tier n gives `2^n` points. Each changed move spawns one
mochi (90% tier 1, 10% tier 2). There is no undo. Audio remains original
procedural placeholder material awaiting human listening (`AUDIO_NOTES.md`).
