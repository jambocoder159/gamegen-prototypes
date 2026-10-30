import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const shared = '/workspace/deploy/node_modules/axe-core/axe.min.js';
const require = createRequire(import.meta.url);
export const axeSource = readFileSync(existsSync(shared) ? shared : require.resolve('axe-core/axe.min.js'), 'utf8');
