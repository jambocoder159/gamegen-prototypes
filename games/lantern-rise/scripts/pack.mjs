// Build the game and zip the CONTENTS of dist/ at the zip root (index.html and
// poster.png at root, no dist/ folder, no sourcemaps). Pure Node — no `zip`
// binary and no third-party dependency (platform requirement).

import { execSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const distDir = join(repo, 'dist');
const zipName = `${basename(repo)}.zip`;
const zipPath = join(repo, zipName);

console.log('Building…');
execSync('npm run build', { cwd: repo, stdio: 'inherit' });

// --- collect files (skip sourcemaps) ---
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (!full.endsWith('.map')) out.push(full);
  }
  return out;
}

const files = walk(distDir).sort();

// --- CRC32 ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- minimal ZIP writer (deflate, no data descriptors) ---
const chunks = [];
const central = [];
let offset = 0;
const push = (b) => {
  chunks.push(b);
  offset += b.length;
};

for (const file of files) {
  const nameBuf = Buffer.from(relative(distDir, file).split('\\').join('/'), 'utf8');
  const data = readFileSync(file);
  const crc = crc32(data);
  const comp = deflateRawSync(data, { level: 9 });
  const useStore = comp.length >= data.length;
  const method = useStore ? 0 : 8;
  const body = useStore ? data : comp;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10); // mod time
  local.writeUInt16LE(0x21, 12); // mod date (1980-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);

  const localOffset = offset;
  push(local);
  push(nameBuf);
  push(body);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4); // version made by
  cen.writeUInt16LE(20, 6); // version needed
  cen.writeUInt16LE(0, 8);
  cen.writeUInt16LE(method, 10);
  cen.writeUInt16LE(0, 12);
  cen.writeUInt16LE(0x21, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt16LE(0, 30);
  cen.writeUInt16LE(0, 32);
  cen.writeUInt16LE(0, 34);
  cen.writeUInt16LE(0, 36);
  cen.writeUInt32LE(0, 38);
  cen.writeUInt32LE(localOffset, 42);
  central.push(Buffer.concat([cen, nameBuf]));
}

const centralStart = offset;
for (const c of central) push(c);
const centralSize = offset - centralStart;

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(central.length, 8);
end.writeUInt16LE(central.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(centralStart, 16);
end.writeUInt16LE(0, 20);
push(end);

writeFileSync(zipPath, Buffer.concat(chunks));

console.log(`\nWrote ${zipName} (${files.length} files, ${(offset / 1024).toFixed(0)} KB):`);
for (const f of files) console.log('  ' + relative(distDir, f).split('\\').join('/'));

const names = files.map((f) => relative(distDir, f));
if (!names.includes('index.html')) console.warn('WARNING: index.html not at zip root!');
if (!names.includes('poster.png')) console.warn('WARNING: poster.png not at zip root!');
