import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
const dir = "public/common/textures",
  lines = [];
let failures = 0;
function png(file) {
  const b = readFileSync(file);
  if (b.toString("hex", 0, 8) !== "89504e470d0a1a0a")
    throw Error("PNG signature");
  let w,
    h,
    depth,
    type,
    palette,
    alpha,
    compressed = [];
  for (let o = 8; o < b.length;) {
    const n = b.readUInt32BE(o),
      kind = b.toString("ascii", o + 4, o + 8),
      d = b.subarray(o + 8, o + 8 + n);
    if (kind === "IHDR") {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      type = d[9];
      if (d[12]) throw Error("interlaced PNG unsupported");
    }
    if (kind === "IDAT") compressed.push(d);
    if (kind === "PLTE") palette = d;
    if (kind === "tRNS") alpha = d;
    o += 12 + n;
  }
  if (depth !== 8) throw Error("expected 8 bit PNG");
  const channels =
    type === 6
      ? 4
      : type === 2
        ? 3
        : type === 4
          ? 2
          : type === 0 || type === 3
            ? 1
            : 0;
  if (!channels) throw Error("PNG color type");
  const data = inflateSync(Buffer.concat(compressed)),
    stride = w * channels,
    raw = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = data[pos++];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? raw[y * stride + x - channels] : 0,
        up = y ? raw[(y - 1) * stride + x] : 0,
        c = y && x >= channels ? raw[(y - 1) * stride + x - channels] : 0;
      let prediction = 0;
      if (filter === 1) prediction = a;
      else if (filter === 2) prediction = up;
      else if (filter === 3) prediction = Math.floor((a + up) / 2);
      else if (filter === 4) {
        const p = a + up - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - up),
          pc = Math.abs(p - c);
        prediction = pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      } else if (filter !== 0) throw Error("PNG filter");
      raw[y * stride + x] = (data[pos++] + prediction) & 255;
    }
  }
  const pixels = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * channels,
      d = i * 4;
    if (type === 6) {
      pixels.set(raw.subarray(o, o + 4), d);
    } else if (type === 3) {
      pixels[d] = palette[raw[o] * 3];
      pixels[d + 1] = palette[raw[o] * 3 + 1];
      pixels[d + 2] = palette[raw[o] * 3 + 2];
      pixels[d + 3] = alpha?.[raw[o]] ?? 255;
    } else if (type === 4) {
      pixels[d] = pixels[d + 1] = pixels[d + 2] = raw[o];
      pixels[d + 3] = raw[o + 1];
    } else {
      pixels[d] = raw[o];
      pixels[d + 1] = type === 2 ? raw[o + 1] : raw[o];
      pixels[d + 2] = type === 2 ? raw[o + 2] : raw[o];
      pixels[d + 3] = 255;
    }
  }
  return { w, h, pixels, hasAlpha: type === 6 || type === 4 || !!alpha };
}
for (const name of readdirSync(dir)
  .filter((n) =>
    /^(hero_|enemy_|boss_|gem_|icon_|fx_|logo_base).*\.png$/.test(n),
  )
  .sort()) {
  try {
    const { w, h, pixels: p, hasAlpha } = png(`${dir}/${name}`),
      mask = new Uint8Array(w * h);
    let count = 0,
      pink = 0,
      semi = 0,
      border = 0,
      minX = w,
      minY = h,
      maxX = -1,
      maxY = -1;
    for (let i = 0; i < w * h; i++) {
      const a = p[i * 4 + 3],
        x = i % w,
        y = Math.floor(i / w);
      if (a > 5 && a < 250) semi++;
      if (a > 0 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) border++;
      if (a >= 128) {
        count++;
        mask[i] = 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    // Background-key fringe: opaque pixels within 2px of transparency whose colour is close to the
    // magenta key (240,5,121). Genuinely purple/pink interiors (gems, bats, demons) are not fringe.
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      const x = i % w,
        y = Math.floor(i / w);
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || p[(ny * w + nx) * 4 + 3] < 128) {
            edge = true;
            break;
          }
        }
      if (!edge) continue;
      const [r, g, b] = p.subarray(i * 4, i * 4 + 3);
      if (Math.hypot(r - 240, g - 5, b - 121) < 70 || (r > 170 && g < 90 && b > 80 && b > g + 50 && b / r > 0.38 && b / r < 0.9)) pink++;
    }
    // Chebyshev dilation by 3 pixels joins deliberate close sprite pieces before
    // 8-neighbor connected-component counting; component areas count original ink.
    const grown = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++)
      if (mask[i]) {
        const x = i % w,
          y = Math.floor(i / w);
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx >= 0 && xx < w && yy >= 0 && yy < h) grown[yy * w + xx] = 1;
          }
      }
    const components = [];
    for (let i = 0; i < grown.length; i++)
      if (grown[i]) {
        const stack = [i];
        grown[i] = 0;
        let ink = 0;
        while (stack.length) {
          const n = stack.pop();
          ink += mask[n];
          const x = n % w,
            y = Math.floor(n / w);
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy,
                j = yy * w + xx;
              if (xx >= 0 && xx < w && yy >= 0 && yy < h && grown[j]) {
                grown[j] = 0;
                stack.push(j);
              }
            }
        }
        if (ink) components.push(ink);
      }
    components.sort((a, b) => b - a);
    const errors = [];
    if (!hasAlpha) errors.push("no alpha");
    if (!count) errors.push("empty");
    if (border) errors.push("opaque outer border");
    if (minX < 1 || minY < 1 || maxX > w - 2 || maxY > h - 2)
      errors.push("bbox margin <1");
    if (pink / count >= 0.003) errors.push("magenta-key fringe >=0.3%");
    if (semi / (w * h) >= 0.02) errors.push("semi-transparent >=2%");
    const strict = /^(hero_|enemy_|boss_|gem_)/.test(name);
    if (strict && components.length > 1) errors.push("disconnected sprite");
    if (
      !strict &&
      !/^(fx_|icon_)/.test(name) &&
      components.slice(1).some((n) => n / count > 0.005)
    )
      errors.push("large fragment");
    if (errors.length) failures++;
    lines.push(
      `${errors.length ? "FAIL" : "PASS"} ${name}: ${w}x${h}, alpha=${hasAlpha}, border=${border}, pink=${((pink / count) * 100).toFixed(3)}%, semi=${((semi / (w * h)) * 100).toFixed(3)}%, components=${components.join("/")} ${errors.join("; ")}`,
    );
  } catch (e) {
    failures++;
    lines.push(`FAIL ${name}: ${e.message}`);
  }
}
lines.push(
  `${lines.length - failures}/${lines.length} sprites passed; ${failures} failed. Textures were read only.`,
);
const report = lines.join("\n") + "\n";
writeFileSync(
  "/workspace/gamegen-games/_reports/sprite_check_match-hero.txt",
  report,
);
console.log(report);
if (failures) process.exitCode = 1;
