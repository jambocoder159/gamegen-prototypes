// Layout constants derived from the supplied art.
//
// METER_CHANNEL: the flat dark channel inside panel_meter.png where the fuel
// fill is drawn, as fractions of the PNG's width/height. Measured programmatically
// by scanning the PNG for the interior flat-colour rectangle (941x116 source:
// channel pixels x[56..886], y[17..85]). Reproduce with scripts/measure_meter.py.
export const METER_CHANNEL = {
  left: 0.0595,
  right: 0.9426,
  top: 0.1466,
  bottom: 0.7414,
} as const;

// Viewport aspect bands (w / h). Portrait is the primary design.
//  - portrait:    w/h <= 0.87   (tall phones, feeds)
//  - near-square: 0.87 < w/h < 1.6 (foldables / tablets, square-ish)
//  - wide:        w/h >= 1.6   (landscape)
export const ASPECT = {
  portraitMax: 0.87,
  wideMin: 1.6,
} as const;

export type LayoutMode = 'portrait' | 'nearsquare' | 'wide';

// The world's visible height is always this many world units.
export const WORLD_H = 640;

// Bottom edge of the top HUD band, in WORLD units, so the simulation can keep
// the lantern's sprite clear of the buttons / Distance·Star pills / fuel bar.
// This mirrors the HUD metrics in styles.css per layout (safe-area insets are 0
// on the design viewports, so they are treated as 0 here):
//   .lr-pill         height clamp(30px, 8vmin, 42px)
//   .lr-iconbtn      height clamp(44px, 12vmin, 60px)
//   .lr-meter        width  min(58vw, 320px), aspect-ratio 941/116
// Portrait drops the pills (top 76px) and meter (top 124px) below the button
// row; wide keeps a single top row and stands the meter on the left edge.
export function hudCeilingWorldY(mode: LayoutMode, w: number, h: number): number {
  const vmin = Math.min(w, h);
  const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pillH = clamp(30, 0.08 * vmin, 42);
  const btnH = clamp(44, 0.12 * vmin, 60);
  const meterH = (Math.min(0.58 * w, 320) * 116) / 941;

  let bottomPx: number;
  if (mode === 'portrait') {
    bottomPx = Math.max(8 + btnH, 76 + pillH, 124 + meterH);
  } else if (mode === 'wide') {
    // Fuel meter is rotated onto the left side, so only the top row counts.
    bottomPx = Math.max(8 + btnH, 8 + pillH);
  } else {
    bottomPx = Math.max(8 + btnH, 8 + pillH, 44 + meterH);
  }
  const HUD_GAP_PX = 10; // keep the lantern a hair below the HUD
  return ((bottomPx + HUD_GAP_PX) * WORLD_H) / h;
}
