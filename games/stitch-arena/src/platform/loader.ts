// Preload gate, in two steps so the loading screen itself can be localised:
//   1. loadLanguages()  — config + the four language JSONs (fast; before UI)
//   2. preloadMedia()    — resolve+decode every image, fetch+decode every audio
//      file, wait for fonts, reporting real overall progress (0..1).
// A single asset failing never rejects the whole load.

import { IMAGES, AUDIO, type ImageKey, type AudioKey } from '../config/assets';
import { loadConfig, loadImage, fetchAudio, loadLanguage } from '../services/assets';
import type { AudioManager } from './audio';
import { LANG_CODES, type LangCode, type Dict } from '../i18n/dict';

export async function loadLanguages(): Promise<Record<LangCode, Dict | null>> {
  await loadConfig();
  const languages = {} as Record<LangCode, Dict | null>;
  await Promise.all(
    LANG_CODES.map(async (code) => {
      languages[code] = (await loadLanguage(code)) as Dict | null;
    }),
  );
  return languages;
}

export async function preloadMedia(
  audio: AudioManager,
  onProgress: (fraction: number) => void,
): Promise<Record<ImageKey, string | null>> {
  const imageKeys = Object.keys(IMAGES) as ImageKey[];
  const audioKeys = Object.keys(AUDIO) as AudioKey[];
  const total = imageKeys.length + audioKeys.length + 1; // +1 fonts
  let done = 0;
  const tick = () => onProgress(Math.min(1, ++done / total));
  onProgress(0);

  const images = {} as Record<ImageKey, string | null>;
  const rawAudio: Partial<Record<AudioKey, ArrayBuffer | null>> = {};

  const imageJobs = imageKeys.map(async (key) => {
    images[key] = await loadImage(IMAGES[key]);
    tick();
  });

  const audioJobs = audioKeys.map(async (key) => {
    rawAudio[key] = await fetchAudio(AUDIO[key]);
    await audio.decode({[key]:rawAudio[key]});
    tick();
  });

  const fontsJob = (async () => {
    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* ignore */
    }
    tick();
  })();

  await Promise.all([...imageJobs, ...audioJobs, fontsJob]);
  return images;
}
