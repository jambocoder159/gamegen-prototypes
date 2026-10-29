// Big-number formatting for dew, costs and rates. Everything is a double; display
// uses the compact suffixes K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, then falls
// back to scientific notation (e.g. 1.23e36). The suffixes are shared across all
// four languages (per PLAN §3) to avoid line-wrap/overflow. Pure and allocation-
// light so it can be unit-tested directly in Node (scripts/test-logic.mjs).

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function trimZeros(s: string): string {
  return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
}

/** Scientific notation like "1.23e36" (mantissa to 2 places, compact exponent). */
function scientific(v: number): string {
  const e = v.toExponential(2); // e.g. "1.23e+36"
  const [m, exp] = e.split('e');
  const n = Number(exp);
  return `${trimZeros(m)}e${n}`;
}

/** Format a non-negative magnitude with compact suffixes / scientific fallback. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '0';
  const neg = value < 0;
  let v = Math.abs(value);
  if (v < 1000) {
    const out = v < 1 && v > 0 ? trimZeros(v.toFixed(2)) : String(Math.floor(v));
    return neg ? '-' + out : out;
  }
  let tier = Math.floor(Math.log10(v) / 3);
  let scaled = v / Math.pow(1000, tier);
  // guard the tier boundary (e.g. 999.95K should read as 1M, not 1000K)
  if (scaled >= 999.5) {
    tier += 1;
    scaled = v / Math.pow(1000, tier);
  }
  if (tier >= UNITS.length) return (neg ? '-' : '') + scientific(v);
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const out = trimZeros(scaled.toFixed(decimals)) + UNITS[tier];
  return neg ? '-' + out : out;
}

/** Per-second rate: keep a decimal for small rates, else compact. */
export function formatRate(value: number): string {
  if (value > 0 && value < 1000) return trimZeros(value.toFixed(1));
  if (value === 0) return '0';
  return formatNumber(value);
}
