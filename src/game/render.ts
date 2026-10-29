// Shared rendering constants for the DOM renderer.
// Draw sizes are in WORLD units; the renderer scales them to pixels.

export interface DrawSize {
  w: number;
  h: number;
}

// Draw sizes in world units (aspect-matched to the source art).
export const DRAW = {
  lantern: { w: 52.9, h: 78 },
  spark: { w: 46, h: 47.3 },
  flame: { w: 34, h: 56 },
  crow: { w: 80, h: 74.4 },
  storm: { w: 116, h: 104.9 },
} satisfies Record<string, DrawSize>;

// Hills (deco_hills 1280x239). The strip's top edge aligns with the ground line.
export const HILL = {
  worldHeight: 158, // one tile's height in world units
  aspect: 1280 / 239,
  topOffset: 8, // world units: how far the strip top sits above the ground line
  parallax: 0.15,
};

