// Fails when the four language files have mismatched key sets or any empty value.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'config', 'language');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const maps = {};
let failed = false;
for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  maps[f] = flatten(data);
}

const names = Object.keys(maps);
if (names.length === 0) {
  console.error('FAIL: no language files found');
  process.exit(1);
}

// reference = union of all keys
const allKeys = new Set();
for (const n of names) for (const k of Object.keys(maps[n])) allKeys.add(k);

for (const n of names) {
  const m = maps[n];
  for (const k of allKeys) {
    if (!(k in m)) {
      console.error(`FAIL: ${n} is missing key "${k}"`);
      failed = true;
    } else if (typeof m[k] !== 'string' || m[k].trim() === '') {
      console.error(`FAIL: ${n} has empty/invalid value for "${k}"`);
      failed = true;
    }
  }
  for (const k of Object.keys(m)) {
    if (!allKeys.has(k)) {
      console.error(`FAIL: ${n} has unexpected key "${k}"`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`OK: ${names.length} language files, ${allKeys.size} keys each, all non-empty.`);
