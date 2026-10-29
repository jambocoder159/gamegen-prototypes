// Verify the four language files share an identical key structure and contain
// no empty values. Exits non-zero on any mismatch (platform rule 4).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'public', 'config', 'language');
const files = ['en.json', 'zh-tw.json', 'zh-cn.json', 'ja.json'];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const dicts = {};
const errors = [];
for (const f of files) {
  try {
    dicts[f] = flatten(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  } catch (e) {
    errors.push(`${f}: cannot parse (${e.message})`);
  }
}

const ref = 'en.json';
const refKeys = Object.keys(dicts[ref] ?? {}).sort();

for (const f of files) {
  const d = dicts[f];
  if (!d) continue;
  const keys = Object.keys(d).sort();
  const missing = refKeys.filter((k) => !(k in d));
  const extra = keys.filter((k) => !refKeys.includes(k));
  if (missing.length) errors.push(`${f}: missing keys: ${missing.join(', ')}`);
  if (extra.length) errors.push(`${f}: extra keys: ${extra.join(', ')}`);
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== 'string' || v.trim() === '') {
      errors.push(`${f}: empty or non-string value at "${k}"`);
    }
  }
}

if (errors.length) {
  console.error('i18n check FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log(`i18n check passed: ${files.length} languages, ${refKeys.length} keys each.`);
