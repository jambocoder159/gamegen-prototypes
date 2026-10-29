// Build, then zip the CONTENTS of dist/ at the zip root (index.html + poster.png
// at root, no dist/ folder, no sourcemaps). Uses Node's zlib (no `zip` binary).
import { execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const zipName = `${basename(root)}.zip`;

console.log('Building…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (!full.endsWith('.map')) out.push(full);
  }
  return out;
}

const files = walk(dist).sort();

// Minimal ZIP writer (store/deflate, no external deps).
const chunks = [];
const central = [];
let offset = 0;

function toDosTime() {
  // Fixed timestamp (no Date dependency / reproducible): 1980-01-01 00:00.
  return { time: 0, date: 0x0021 };
}

for (const file of files) {
  const data = readFileSync(file);
  const name = relative(dist, file).split(/[\\/]/).join('/');
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data) >>> 0;
  const deflated = deflateRawSync(data);
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const method = useDeflate ? 8 : 0;
  const { time, date } = toDosTime();

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 flag
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
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
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(method, 10);
  cen.writeUInt16LE(time, 12);
  cen.writeUInt16LE(date, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(0, 42); // local header offset
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

const zip = Buffer.concat([...chunks, centralBuf, end]);
writeFileSync(join(root, zipName), zip);

console.log(`\nWrote ${zipName} (${zip.length} bytes), ${files.length} entries:`);
for (const f of files) console.log('  ' + relative(dist, f).split(/[\\/]/).join('/'));
