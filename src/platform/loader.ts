// Preload gate: resolve + decode every image, decode every audio buffer, load the
// four language JSONs, wait for fonts. Reports overall progress 0..1. One failed
// asset never rejects the whole load (image -> '', audio -> missing buffer, json -> {}).

import { IMAGE_ASSETS, AUDIO_ASSETS, type ImageKey, type AudioKey } from '../config/assets';
import { candidatesFor, languageUrl } from '../services/assets';
import { LANGS, type Lang } from '../i18n/index';

export interface PreloadResult {
  images: Record<string, string>; // key -> working URL ('' if all candidates failed)
  audioData: Record<string, ArrayBuffer | null>; // key -> encoded bytes (decoded later by AudioManager)
}

function tryDecodeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // decode() may reject on some engines; treat either outcome as "loaded"
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve(true)).catch(() => resolve(true));
      } else {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function loadImageKey(key: ImageKey): Promise<string> {
  for (const url of candidatesFor(IMAGE_ASSETS[key])) {
    // eslint-disable-next-line no-await-in-loop
    if (await tryDecodeImage(url)) return url;
  }
  return '';
}

async function loadAudioKey(key: AudioKey): Promise<ArrayBuffer | null> {
  for (const url of candidatesFor(AUDIO_ASSETS[key])) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, { cache: 'force-cache' });
      if (res.ok) return await res.arrayBuffer();
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

async function loadLang(lang: Lang): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(languageUrl(lang), { cache: 'no-cache' });
    if (res.ok) return (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

// Loaded first so the loading screen can show localised progress text.
export async function loadLanguages(): Promise<Record<string, Record<string, unknown>>> {
  const langs: Record<string, Record<string, unknown>> = {};
  await Promise.all(LANGS.map(async (l) => (langs[l] = await loadLang(l))));
  return langs;
}

export async function preloadAll(onProgress: (p: number) => void): Promise<PreloadResult> {
  const imageKeys = Object.keys(IMAGE_ASSETS) as ImageKey[];
  const audioKeys = Object.keys(AUDIO_ASSETS) as AudioKey[];
  const total = imageKeys.length + audioKeys.length + 1; // +1 for fonts
  let done = 0;
  const tick = () => {
    done += 1;
    onProgress(Math.min(1, done / total));
  };

  const images: Record<string, string> = {};
  const audioData: Record<string, ArrayBuffer | null> = {};

  const jobs: Promise<void>[] = [];

  for (const k of imageKeys) {
    jobs.push(
      loadImageKey(k).then((url) => {
        images[k] = url;
        tick();
      }),
    );
  }
  for (const k of audioKeys) {
    jobs.push(
      loadAudioKey(k).then((buf) => {
        audioData[k] = buf;
        tick();
      }),
    );
  }

  const fontsReady = (document.fonts && document.fonts.ready
    ? document.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve()
  ).then(tick);
  jobs.push(fontsReady);

  await Promise.all(jobs);
  onProgress(1);
  return { images, audioData };
}
