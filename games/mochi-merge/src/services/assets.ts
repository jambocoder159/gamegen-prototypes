// Per-asset resolver. For each asset we build an ordered list of candidate base
// URLs and try them in turn until one loads; a single failure never throws (the
// caller falls back to a placeholder / silence / English). Resolution order:
//   1. ?style=<root>  (validated: http(s) or same-origin relative; else ignored)
//   2. commonPath from generalConfiguration.json
//   3. <BASE_URL>common/   (works when served from a sub-path)
//   4. <BASE_URL>          (local public/ root)

interface GeneralConfig {
  isLocal: boolean;
  commonPath: string;
}

const BASE = import.meta.env.BASE_URL || '/';

let config: GeneralConfig = { isLocal: true, commonPath: '/common/' };

function withTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : s + '/';
}

function stripLeadingSlash(s: string): string {
  return s.replace(/^\/+/, '');
}

/** Validated ?style= root, or null. */
function styleRoot(): string | null {
  try {
    const raw = new URLSearchParams(location.search).get('style');
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return withTrailingSlash(raw);
    // same-origin relative path only (no protocol-relative, no scheme)
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
    return withTrailingSlash(raw);
  } catch {
    return null;
  }
}

function bases(): string[] {
  const list: string[] = [];
  const style = styleRoot();
  if (style) list.push(style);
  // The platform's local /common/ default belongs to this game, including
  // when its ZIP is mounted below a path. Explicit remote roots remain intact.
  if (config.commonPath) list.push(withTrailingSlash(
    config.isLocal && config.commonPath === '/common/' ? BASE + 'common/' : config.commonPath,
  ));
  list.push(withTrailingSlash(BASE + 'common/'));
  list.push(withTrailingSlash(BASE));
  return [...new Set(list)];
}

/** Ordered candidate URLs for a common asset relativePath (e.g. "textures/x.png"). */
export function candidates(relativePath: string): string[] {
  const rel = stripLeadingSlash(relativePath);
  return bases().map((b) => b + rel);
}

/** Load generalConfiguration.json (best-effort; keeps defaults on failure). */
export async function loadConfig(): Promise<void> {
  try {
    const res = await fetch(BASE + 'config/generalConfiguration.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        config = {
          isLocal: data.isLocal !== false,
          commonPath:
            typeof data.commonPath === 'string' && data.commonPath ? data.commonPath : '/common/',
        };
      }
    }
  } catch {
    /* keep defaults */
  }
}

/** Load+decode an image, trying each candidate. Resolves with a usable URL or null. */
export function loadImage(relativePath: string): Promise<string | null> {
  const urls = candidates(relativePath);
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) {
        resolve(null);
        return;
      }
      const url = urls[i++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const done = () => resolve(url);
        if (img.decode) img.decode().then(done, done);
        else done();
      };
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

/** Fetch an audio file as an ArrayBuffer, trying each candidate. */
export async function fetchAudio(relativePath: string): Promise<ArrayBuffer | null> {
  for (const url of candidates(relativePath)) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (res.ok) return await res.arrayBuffer();
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Load a language JSON from the local config dir. Resolves null on failure. */
export async function loadLanguage(code: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(BASE + `config/language/${code}.json`, { cache: 'no-cache' });
    if (res.ok) return (await res.json()) as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  return null;
}
