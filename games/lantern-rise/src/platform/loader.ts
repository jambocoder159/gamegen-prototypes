// Preload gate: decode every image, decode every audio file into WebAudio
// buffers, load the four language JSONs, and wait for fonts. Reports overall
// progress as a fraction in [0,1]. One failed asset never aborts the load.

import { IMAGE_ASSETS, AUDIO_ASSETS } from '../config/assets';
import { candidateUrls, configUrl, initResolver } from '../services/assetResolver';
import { audio } from './audio';
import { LANG_FILES, type LangCode, type Dict } from '../i18n/langs';

export interface LoadedMedia {
  images: Map<string, HTMLImageElement>;
  imageOk: Map<string, boolean>;
}

function loadOneImage(urls: string[]): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let i = 0;
    const attempt = () => {
      if (i >= urls.length) {
        resolve(null);
        return;
      }
      const url = urls[i++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const done = () => resolve(img);
        if (img.decode) img.decode().then(done, done);
        else done();
      };
      img.onerror = attempt;
      img.src = url;
    };
    attempt();
  });
}

async function loadOneAudio(urls: string[], ctx: AudioContext): Promise<AudioBuffer | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      return await ctx.decodeAudioData(bytes.slice(0));
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

async function loadDict(code: LangCode): Promise<Dict | null> {
  try {
    const res = await fetch(configUrl(`config/language/${LANG_FILES[code]}`));
    if (!res.ok) return null;
    return (await res.json()) as Dict;
  } catch {
    return null;
  }
}

// Phase 1: resolver + the four language JSONs. Fast; done before the loading
// screen so its "Loading NN%" text can be localised.
export async function loadDicts(): Promise<Map<LangCode, Dict>> {
  await initResolver();
  const langCodes = Object.keys(LANG_FILES) as LangCode[];
  const dicts = new Map<LangCode, Dict>();
  await Promise.all(
    langCodes.map(async (code) => {
      const dict = await loadDict(code);
      if (dict) dicts.set(code, dict);
    }),
  );
  return dicts;
}

// Phase 2: decode every image, decode every audio file into WebAudio buffers,
// and wait for fonts. Reports real overall progress in [0,1].
export async function preloadMedia(onProgress: (frac: number) => void): Promise<LoadedMedia> {
  const ctx = audio.getContext();

  const total = IMAGE_ASSETS.length + AUDIO_ASSETS.length + 1; // +1 fonts
  let done = 0;
  const tick = () => {
    done++;
    onProgress(Math.min(1, done / total));
  };
  onProgress(0);

  const images = new Map<string, HTMLImageElement>();
  const imageOk = new Map<string, boolean>();
  const audioBuffers = new Map<string, AudioBuffer>();

  const imageJobs = IMAGE_ASSETS.map(async (a) => {
    const img = await loadOneImage(candidateUrls(a.path));
    if (img) {
      images.set(a.key, img);
      imageOk.set(a.key, true);
    } else {
      imageOk.set(a.key, false);
    }
    tick();
  });

  const audioJobs = AUDIO_ASSETS.map(async (a) => {
    const buf = await loadOneAudio(candidateUrls(a.path), ctx);
    if (buf) audioBuffers.set(a.key, buf);
    tick();
  });

  const fontJob = (async () => {
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch {
      /* ignore */
    }
    tick();
  })();

  await Promise.all([...imageJobs, ...audioJobs, fontJob]);

  audio.setBuffers(audioBuffers);
  onProgress(1);
  return { images, imageOk };
}
