// Geometry measured programmatically from the source PNGs (see scripts below the table).
// Values are fractions (0..1) of each texture's own width/height.
//
// Reproduce with PIL:
//   panel_bar  flat fill channel  -> inset of the dark solid interior vs the black frame
//   panel_bubble cream interior   -> safe area to place order icons (tail excluded)
//   icon_bowl  broth surface      -> ellipse where topping icons sit

export const PANEL_BAR = {
  // flat solid channel inside the frame (measured: x 0.018..0.982, y 0.144..0.867)
  fill: { left: 0.028, top: 0.17, right: 0.972, bottom: 0.83 },
  // native aspect ratio (734x90) used to keep the frame crisp
  aspect: 734 / 90,
};

export const PANEL_BUBBLE = {
  // safe inset for order icons inside the cream area (tail hangs below-left, excluded)
  content: { left: 0.09, top: 0.1, right: 0.91, bottom: 0.66 },
  aspect: 460 / 244,
};

export const PANEL_BUTTON = {
  aspect: 514 / 142,
};

export const BOWL = {
  aspect: 286 / 241,
  // broth surface ellipse (measured centre ~0.5,0.37; radii trimmed to stay on the soup)
  broth: { cx: 0.5, cy: 0.41, rx: 0.29, ry: 0.135 },
};

// Topping icon slot positions on the broth ellipse, in order of being added.
// Angles chosen so 1..4 icons stay inside the soup and never overlap the rim.
export const BOWL_SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: -0.55, y: -0.15 }, // left
  { x: 0.55, y: -0.15 }, // right
  { x: -0.18, y: 0.55 }, // front-left
  { x: 0.5, y: 0.6 }, // front-right
];
