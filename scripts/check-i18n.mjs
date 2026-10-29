// Fails when the four language files have different key sets or any empty value.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'zh-tw', 'zh-cn', 'ja'];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const data = {};
for (const lang of LANGS) {
  const p = join(root, 'public', 'config', 'language', `${lang}.json`);
  data[lang] = flatten(JSON.parse(readFileSync(p, 'utf8')));
}

const base = Object.keys(data.en).sort();
let failed = false;

for (const lang of LANGS) {
  const keys = Object.keys(data[lang]).sort();
  const missing = base.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !base.includes(k));
  if (missing.length) {
    failed = true;
    console.error(`[${lang}] missing keys: ${missing.join(', ')}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`[${lang}] extra keys: ${extra.join(', ')}`);
  }
  for (const [k, v] of Object.entries(data[lang])) {
    if (typeof v !== 'string' || v.trim() === '') {
      failed = true;
      console.error(`[${lang}] empty/invalid value for key: ${k}`);
    }
  }
}

if (failed) {
  console.error('check:i18n FAILED');
  process.exit(1);
}
console.log(`check:i18n OK — ${base.length} keys × ${LANGS.length} languages`);
