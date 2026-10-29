// Per-asset resolver. Builds an ordered list of candidate roots and returns the
// candidate URLs for a given fixed relativePath. The loader tries them in order.
//
// Order (DEV_SPEC §2): ?style=<root> (validated) -> commonPath from
// generalConfiguration.json -> BASE_URL + 'common/' -> local public root (BASE_URL).

let roots: string[] = [];

function withSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}

function normalizeBase(): string {
  // import.meta.env.BASE_URL is e.g. './' or '/sub/'. Make it a usable prefix.
  let b = import.meta.env.BASE_URL || '/';
  if (b === './') b = '';
  return b === '' ? '' : withSlash(b);
}

function validateStyle(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) {
      // absolute http(s) URL is allowed
      return withSlash(value);
    }
    // reject protocol-relative or scheme-bearing values
    if (/^\/\//.test(value) || /^[a-z]+:/i.test(value)) return null;
    // same-origin relative path -> resolve against base
    const rel = value.replace(/^\/+/, '');
    return withSlash(base + rel);
  } catch {
    return null;
  }
}

export async function initAssetRoots(): Promise<void> {
  const base = normalizeBase();
  const list: string[] = [];

  try {
    const style = new URLSearchParams(window.location.search).get('style');
    const sr = validateStyle(style, base);
    if (sr) list.push(sr);
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(base + 'config/generalConfiguration.json', { cache: 'no-cache' });
    if (res.ok) {
      const cfg = (await res.json()) as { commonPath?: unknown };
      if (cfg && typeof cfg.commonPath === 'string' && cfg.commonPath) {
        list.push(withSlash(cfg.commonPath));
      }
    }
  } catch {
    /* ignore — fall through to defaults */
  }

  list.push(base + 'common/');
  list.push(base === '' ? '' : base);

  roots = list.filter((v, i) => list.indexOf(v) === i);
}

export function candidatesFor(relativePath: string): string[] {
  const rel = relativePath.replace(/^\/+/, '');
  if (roots.length === 0) {
    // not initialised yet — best effort
    const base = normalizeBase();
    return [base + 'common/' + rel];
  }
  return roots.map((r) => r + rel);
}

// Language JSONs live under config/language/, not under the common asset root.
export function languageUrl(lang: string): string {
  return normalizeBase() + `config/language/${lang}.json`;
}
