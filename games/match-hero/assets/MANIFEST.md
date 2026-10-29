# Asset manifest
See PLAN.md §7. Raw generated sheets in assets/raw; processed by /workspace/gamegen-games/_tools/run_prep7.py (magenta chroma key + grid split; no repainting).

The delivered `ui_sheet.png` is the final atlas containing logo and UI icons; separate `logo_base.png` and `icon_*.png` files were not supplied. `src/game/Art.tsx` displays the unchanged atlas regions. All hero, enemy and gem frames have separate PNGs; backgrounds are WebP. `public/poster.png` is a 9:16 browser capture using this supplied art.
