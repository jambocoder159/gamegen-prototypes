// Node unit test for the stage layouts and the deal generator (no browser).
// Mirrors the pure logic in src/game/logic.ts + src/game/layouts.ts and checks,
// for all five stages:
//   • no two tiles overlap at the same layer / position,
//   • the deal has an even number of tiles per face (whole pairs),
//   • the generated deal is actually clearable by an INDEPENDENT greedy-with-
//     backtracking solver (not the generator's own peel order),
//   • stage 5 fits a 360×640 viewport with tiles ≥ 24px wide (reports the width).
// Run with `npm run test:logic`. Exits non-zero on any failure.

// ---- pure logic (mirror of src/game/logic.ts) ----------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ---- shared tile geometry (mirror of src/game/geometry.ts) ---------------
const BT = 72, ASPECT = 182 / 199, HT = BT / ASPECT;
const LAYER_OFF_X = 0, LAYER_OFF_Y = 0;
const COVER_MIN_FRAC = 0.12;
const TILE_AREA = BT * HT;
function box(p) {
  const left = p.x * (BT / 2) + p.z * LAYER_OFF_X;
  const top = p.y * (HT / 2) + p.z * LAYER_OFF_Y;
  return { left, top, right: left + BT, bottom: top + HT };
}
function interArea(a, b) {
  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}
const boxCovers = (t, o) => interArea(box(t), box(o)) >= COVER_MIN_FRAC * TILE_AREA;
function boxSideTouches(t, o, dir) {
  const a = box(t), b = box(o);
  const v = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (v <= 0) return false;
  const EPS = 0.5;
  return dir < 0
    ? b.left < a.left && b.right > a.left - EPS
    : b.right > a.right && b.left < a.right + EPS;
}
// no-same-layer-overlap check still works on footprints (pre-scale, offset-free)
const overlap = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
function isFree(tile, tiles) {
  if (tile.removed) return false;
  for (const o of tiles) {
    if (o.removed || o === tile) continue;
    if (o.z > tile.z && boxCovers(tile, o)) return false;
  }
  let left = false;
  let right = false;
  for (const o of tiles) {
    if (o.removed || o === tile || o.z !== tile.z) continue;
    if (boxSideTouches(tile, o, -1)) left = true;
    if (boxSideTouches(tile, o, 1)) right = true;
  }
  return !left || !right;
}
const freeTiles = (tiles) => tiles.filter((t) => isFree(t, tiles));
function peelOrder(positions, rng) {
  const tiles = positions.map((p, id) => ({ ...p, id, removed: false }));
  const pairs = [];
  let left = tiles.length;
  while (left > 0) {
    const free = freeTiles(tiles);
    if (free.length < 2) return null;
    free.sort((a, b) => b.z - a.z || rng() - 0.5);
    free[0].removed = true;
    free[1].removed = true;
    pairs.push([free[0].id, free[1].id]);
    left -= 2;
  }
  return pairs;
}
function generateDeal(positions, K, seed) {
  const rng = mulberry32(seed);
  const pairs = peelOrder(positions, rng);
  if (!pairs) return null;
  const tiles = positions.map((p, id) => ({ ...p, id, type: -1, removed: false }));
  const typeForPair = [];
  for (let i = 0; i < pairs.length; i++) typeForPair.push(i % K);
  for (let i = typeForPair.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [typeForPair[i], typeForPair[j]] = [typeForPair[j], typeForPair[i]];
  }
  pairs.forEach(([a, b], i) => {
    tiles[a].type = typeForPair[i];
    tiles[b].type = typeForPair[i];
  });
  return tiles;
}

// ---- stage layouts (mirror of src/game/layouts.ts) -----------------------
function rect(x0, y0, cols, rows, z) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 2, y: y0 + r * 2, z });
  return out;
}
const DEFS = [
  { K: 6, layers: [rect(0, 0, 4, 4, 0), rect(1, 2, 3, 2, 1), rect(2, 3, 2, 1, 2)] },
  { K: 8, layers: [rect(0, 0, 5, 4, 0), rect(1, 1, 4, 3, 1), rect(1, 3, 4, 1, 2)] },
  { K: 10, layers: [rect(0, 0, 6, 4, 0), rect(2, 1, 4, 3, 1), rect(2, 2, 4, 2, 2), rect(4, 2, 2, 2, 3)] },
  { K: 12, layers: [rect(0, 0, 7, 4, 0), rect(3, 0, 4, 4, 1), rect(2, 2, 5, 2, 2), rect(4, 2, 3, 2, 3)] },
  { K: 14, layers: [rect(0, 0, 8, 4, 0), rect(2, 1, 6, 3, 1), rect(1, 2, 7, 2, 2), rect(4, 2, 4, 2, 3)] },
];
const dealSeed = (stageIndex) => Math.imul(0x9e3779b1, stageIndex + 1) >>> 0;

// ---- independent greedy-with-backtracking solver -------------------------
// DFS over matched pairs with memoisation of dead states; proves the typed deal
// is fully clearable without reusing the generator's peel order.
function solvable(tiles0) {
  const tiles = tiles0.map((t) => ({ ...t }));
  const failed = new Set();
  let nodes = 0;
  const NODE_CAP = 2_000_000;
  const key = () => tiles.filter((t) => !t.removed).map((t) => t.id).join(',');
  function dfs() {
    if (tiles.every((t) => t.removed)) return true;
    if (++nodes > NODE_CAP) return false;
    const k = key();
    if (failed.has(k)) return false;
    const free = freeTiles(tiles);
    // group free tiles by type and try each same-type pair
    const byType = new Map();
    for (const t of free) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(t);
    }
    for (const [, group] of byType) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          group[i].removed = true;
          group[j].removed = true;
          if (dfs()) return true;
          group[i].removed = false;
          group[j].removed = false;
        }
      }
    }
    failed.add(k);
    return false;
  }
  return dfs();
}

// ---- board-scale math (mirror of BoardView, using the shared geometry) ----
function minTileWidth(positions, availW, availH) {
  let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
  for (const p of positions) {
    const b = box(p);
    minL = Math.min(minL, b.left);
    minT = Math.min(minT, b.top);
    maxR = Math.max(maxR, b.right);
    maxB = Math.max(maxB, b.bottom);
  }
  const scale = Math.min(availW / (maxR - minL), availH / (maxB - minT));
  return scale * BT;
}

// ---- run -----------------------------------------------------------------
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
  if (!ok) failures++;
}

for (let i = 0; i < DEFS.length; i++) {
  const { K, layers } = DEFS[i];
  const positions = layers.flat();
  const n = positions.length;

  // 1) no same-z overlaps
  let sameZ = false;
  for (let a = 0; a < n && !sameZ; a++)
    for (let b = a + 1; b < n; b++)
      if (positions[a].z === positions[b].z && overlap(positions[a], positions[b])) { sameZ = true; break; }
  check(`stage ${i + 1}: no same-layer overlaps (${n} tiles)`, !sameZ);

  // 2) deal generates, even pair counts per face
  const deal = generateDeal(positions, K, dealSeed(i));
  check(`stage ${i + 1}: deal generated`, !!deal);
  if (!deal) continue;
  const counts = {};
  for (const t of deal) counts[t.type] = (counts[t.type] || 0) + 1;
  const allEven = Object.values(counts).every((c) => c % 2 === 0);
  check(`stage ${i + 1}: even tile count per face`, allEven, Object.values(counts).join(','));

  // 3) independent solver clears it
  check(`stage ${i + 1}: deal solvable (greedy + backtracking)`, solvable(deal));
}

// 4) stage 5 fits 360×640 with tiles ≥ 24px. Board area ≈ full width minus side
//    padding, height minus HUD + hand + controls rows (conservative estimate).
const s5 = DEFS[4].layers.flat();
const availW = 360 - 16;
const availH = 640 - 56 - 112 - 56 - 28; // hud + hand + controls + gaps
const w = minTileWidth(s5, availW, availH);
check(`stage 5 fits 360×640 with tiles ≥ 24px`, w >= 24, `min tile width ≈ ${w.toFixed(1)}px (board area ${availW}×${availH})`);

console.log(`\n${failures === 0 ? 'ALL LOGIC CHECKS PASSED' : failures + ' LOGIC CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
