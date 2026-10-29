// Root: owns the AudioManager, runs preloading (languages first so the
// loading screen is localised, then media), wires up the providers, and switches
// between title and play. Resizing/reduced-motion are read live by child hooks.
import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './platform/audio';
import { AudioProvider } from './platform/AudioContext';
import { ImagesProvider } from './platform/ImagesContext';
import { I18nProvider } from './i18n';
import type { Dict, LangCode } from './i18n/dict';
import { loadLanguages, preloadMedia } from './platform/loader';
import type { ImageKey } from './config/assets';
import { useViewport } from './platform/layout';
import { useReducedMotion } from './platform/reducedMotion';
import { LoadingScreen } from './game/LoadingScreen';
import { TitleScreen } from './game/TitleScreen';
import { GameScreen } from './game/GameScreen';
import { Art } from './game/components/Art';
import { readRun, clearRun } from './game/storage';
import { useAudio } from './platform/AudioContext';

function GameRoot() {
  const vp = useViewport();
  const reduced = useReducedMotion();
  const { manager } = useAudio();
  const [savedRun, setSavedRun] = useState(readRun);
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const start = (resume: boolean) => {
    void manager.resume().then(() => { manager.startBgm(); manager.playSfx('sfxClick'); });
    if (!resume) { clearRun(); setSavedRun(null); }
    setScreen('play');
  };
  const bgKey: ImageKey = vp.layout === 'portrait' ? 'bgPortrait' : 'bgBase';
  return (
    <main className={`app app--${vp.layout}`}>
      <Art imgKey={bgKey} alt="" className="app__bg" />
      {screen === 'title' ? (
        <TitleScreen layout={vp.layout} reduced={reduced} hasRun={!!savedRun} onPlay={() => start(!!savedRun)} onNewGame={() => start(false)} />
      ) : (
        <GameScreen layout={vp.layout} reduced={reduced} savedRun={savedRun} />
      )}
    </main>
  );
}

export function App() {
  const audioRef = useRef<AudioManager | null>(null);
  if (!audioRef.current) audioRef.current = new AudioManager();
  const audio = audioRef.current;

  const [langs, setLangs] = useState<Record<LangCode, Dict | null> | null>(null);
  const [images, setImages] = useState<Record<ImageKey, string | null> | null>(null);
  const [progress, setProgress] = useState(0);

  // Step 1: languages (fast) so the loading screen can be localised.
  useEffect(() => {
    let alive = true;
    loadLanguages().then((l) => {
      if (alive) setLangs(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Step 2: media, once languages are in.
  useEffect(() => {
    if (!langs) return;
    let alive = true;
    preloadMedia(audio, (f) => alive && setProgress(f)).then((imgs) => {
      if (alive) setImages(imgs);
    });
    return () => {
      alive = false;
    };
  }, [langs, audio]);

  useEffect(() => () => audio.dispose(), [audio]);

  if (!langs) {
    return <div className="boot" aria-hidden />;
  }

  return (
    <I18nProvider dicts={langs}>
      <AudioProvider manager={audio}>
        {!images ? (
          <LoadingScreen progress={progress} />
        ) : (
          <ImagesProvider images={images}>
            <GameRoot />
          </ImagesProvider>
        )}
      </AudioProvider>
    </I18nProvider>
  );
}
