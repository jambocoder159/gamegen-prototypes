import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const shared = '/workspace/deploy/node_modules/axe-core/axe.min.js';
// Prefer the QA installation; a local dev dependency supports fresh checkouts.
export const axeSource = readFileSync(existsSync(shared) ? shared :
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
