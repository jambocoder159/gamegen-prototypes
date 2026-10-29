// Bundles the TypeScript game logic with esbuild (which ships with Vite — no new
// runtime deps) into node_modules/.cache and dynamically imports it, so the sim
// and the logic tests drive the real game modules. A tiny localStorage shim lets
// save.ts load/write without a DOM.
import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

export async function loadLogic() {
  const outdir = join(root, 'node_modules', '.cache', 'tap-garden');
  mkdirSync(outdir, { recursive: true });
  const outfile = join(outdir, 'logic.mjs');
  await build({
    entryPoints: [join(here, '_logic-entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

/** Minimal in-memory localStorage so save.ts works under Node. */
export function installLocalStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}
