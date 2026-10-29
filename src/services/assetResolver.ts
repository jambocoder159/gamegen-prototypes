// Per-asset URL resolution (GameGen platform rule 5.2).
//
// For each asset we build an ordered list of candidate base URLs and let the
// loader try them in turn until one succeeds:
//   1. ?style=<root>  query param (if it validates as http(s) or same-origin)
//   2. commonPath from config/generalConfiguration.json
//   3. <page base>/common/   (works when served from a sub-path)
//   4. <page base>/          (plain public root)
// A failed asset never breaks the game; the loader falls back to a placeholder.

let commonPath = '/common/';
let styleRoot: string | null = null;
let initialised = false;

/** Directory URL of the current document (handles sub-path deployments). */
function pageBase(): string {
  return new URL('.', document.baseURI).href;
}

function withSlash(u: string): string {
  return u.endsWith('/') ? u : u + '/';
}

/** Validate a ?style root: must be http(s) absolute or same-origin relative. */
function validateStyleRoot(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, pageBase());
    if (u.protocol === 'http:' || u.protocol === 'https:') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function initResolver(): Promise<void> {
  if (initialised) return;
  initialised = true;
  try {
    const params = new URLSearchParams(window.location.search);
    styleRoot = validateStyleRoot(params.get('style'));
  } catch {
    styleRoot = null;
  }
  try {
    const url = new URL('config/generalConfiguration.json', pageBase()).href;
    const res = await fetch(url);
    if (res.ok) {
      const cfg = (await res.json()) as { commonPath?: unknown };
      if (cfg && typeof cfg.commonPath === 'string' && cfg.commonPath.trim()) {
        commonPath = cfg.commonPath.trim();
      }
    }
  } catch {
    /* keep default commonPath */
  }
}

/** Ordered candidate URLs for one relative asset path (e.g. "textures/x.png"). */
export function candidateUrls(relativePath: string): string[] {
  const rel = relativePath.replace(/^\/+/, '');
  const bases: string[] = [];
  const push = (b: string) => {
    let abs: string;
    try {
      abs = new URL(b, pageBase()).href;
    } catch {
      return;
    }
    abs = withSlash(abs);
    if (!bases.includes(abs)) bases.push(abs);
  };
  if (styleRoot) push(styleRoot);
  push(commonPath);
  push(pageBase() + 'common/');
  push(pageBase());
  return bases.map((b) => b + rel);
}

/** URL for a config/language JSON file (not routed through commonPath). */
export function configUrl(relativePath: string): string {
  return new URL(relativePath.replace(/^\/+/, ''), pageBase()).href;
}
