// Root: owns the AudioManager, runs the preload gate (languages first so the
// loading screen is localised, then media), wires up the providers, and switches
// between title and play. Resizing/reduced-motion are read live by child hooks.
import { useEffect, useMemo, useRef, useState } from 'react';
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

type Phase = 'loading' | 'ready';

function GameRoot() {
  const vp = useViewport();
  const reduced = useReducedMotion();
  const [play, setPlay] = useState<{ on: boolean; level: number }>({ on: false, level: 1 });
  const bgKey: ImageKey = vp.layout === 'portrait' ? 'bgPortrait' : 'bgBase';
  return (
    <div className={`app app--${vp.layout}`}>
      <Art imgKey={bgKey} alt="" className="app__bg" />
      {play.on ? (
        <GameScreen layout={vp.layout} reduced={reduced} startLevel={play.level} />
      ) : (
        <TitleScreen
          layout={vp.layout}
          reduced={reduced}
          onPlay={(level) => setPlay({ on: true, level })}
        />
      )}
    </div>
  );
}

export function App() {
  const audioRef = useRef<AudioManager | null>(null);
  if (!audioRef.current) audioRef.current = new AudioManager();
  const audio = audioRef.current;

  const [langs, setLangs] = useState<Record<LangCode, Dict | null> | null>(null);
  const [images, setImages] = useState<Record<ImageKey, string | null> | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');

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

  const onEnter = async () => {
    await audio.resume();
    audio.startBgm();
    setPhase('ready');
  };

  const fallbackLangs = useMemo(
    () => ({ en: null, 'zh-tw': null, 'zh-cn': null, ja: null }) as Record<LangCode, Dict | null>,
    [],
  );

  if (!langs) {
    return <div className="boot" aria-hidden />;
  }

  return (
    <I18nProvider dicts={langs ?? fallbackLangs}>
      <AudioProvider manager={audio}>
        {phase === 'loading' || !images ? (
          <LoadingScreen progress={progress} ready={!!images} onEnter={onEnter} />
        ) : (
          <ImagesProvider images={images}>
            <GameRoot />
          </ImagesProvider>
        )}
      </AudioProvider>
    </I18nProvider>
  );
}
