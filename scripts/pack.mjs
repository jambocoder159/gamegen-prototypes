// Build, then write <repo-name>.zip containing the CONTENTS of dist/ at the zip root
// (index.html + poster.png at root, no dist/ folder, no sourcemaps). Uses Node only.
import { execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const name = basename(root);

console.log('Building…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (!p.endsWith('.map')) out.push(p);
  }
  return out;
}

// --- minimal ZIP writer (store/deflate, no external tool) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name: fname, data } of files) {
    const nameBuf = Buffer.from(fname, 'utf8');
    const crc = crc32(data);
    const comp = deflateRawSync(data);
    const useStore = comp.length >= data.length;
    const body = useStore ? data : comp;
    const method = useStore ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, nameBuf]));

    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

const files = walk(dist).map((p) => ({
  name: relative(dist, p).split('\\').join('/'),
  data: readFileSync(p),
}));

const zipBuf = zip(files);
const outPath = join(root, `${name}.zip`);
writeFileSync(outPath, zipBuf);

console.log(`\nWrote ${name}.zip (${(zipBuf.length / 1024).toFixed(1)} KB), ${files.length} entries:`);
for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${f.name} (${f.data.length} B)`);
}
if (!files.some((f) => f.name === 'index.html')) throw new Error('index.html missing at zip root');
if (!files.some((f) => f.name === 'poster.png')) throw new Error('poster.png missing at zip root');
