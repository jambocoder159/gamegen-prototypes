# Noodle Night（夜市麵攤）

A one-handed night-market noodle game. Customers show an order bubble of 1–4
toppings; build the matching bowl and serve before their patience runs out. Correct
serves build a combo multiplier; three mistakes (or impatient customers) close the
stall. React 19 + TypeScript + Vite, four languages, works from any sub-path.

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc --noEmit + vite build  → dist/
npm run preview    # serve the build on :4173
```

## Checks

```bash
npm run check:i18n     # key-set parity + empty-value check across en/zh-tw/zh-cn/ja
npm run test:headless  # build, serve, drive the real game in headless Chrome, screenshots -> qa/
npm run pack           # build + write noodle-night.zip (dist contents at the zip root)
```

`test:headless` needs Chrome at `/usr/bin/google-chrome`.

## Controls

- **Pointer / touch:** tap topping buttons to add/remove, tap the bowl to empty it,
  tap **Serve**. Tap a customer to choose who you are serving.
- **Keyboard:** `1`–`6` toggle toppings, `Enter`/`Space` serve, `C`/`Backspace`
  clear, `←`/`→` pick a customer, `Tab`/`Shift+Tab` move between buttons.

## Notes

- All player-visible text comes from `public/config/language/*.json`; language
  switches live and persists in `localStorage`.
- Best score persists in `localStorage` (`noodle_night_best`).
- Panel/bowl geometry in `src/config/layout.ts` is measured from the source PNGs.
- See `AUDIO_NOTES.md` for audio provenance.

## Known gaps

- Chinese/Japanese wording is an AI first draft awaiting a native-speaker pass.
- Audio is procedural and awaits a human ear-selection pass (see `AUDIO_NOTES.md`).
