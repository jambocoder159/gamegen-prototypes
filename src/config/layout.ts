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
