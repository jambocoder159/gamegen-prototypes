import { useCallback, useEffect, useRef, useState } from 'react';
import { initAssetRoots } from '../services/assets';
import { preloadAll, loadLanguages } from '../platform/loader';
import { initI18n } from '../i18n/index';
import { clearRun, loadRun } from '../game/storage';
import type { GameState } from '../game/logic';
import { audio } from '../platform/audio';
import { AssetsContext, type ImageMap } from './assets-context';
import { LoadingScreen } from './LoadingScreen';
import { TitleScreen } from './TitleScreen';
import { GameScreen } from './GameScreen';
import { useImages, imgUrl } from './assets-context';
import { useViewport } from '../platform/layout';

type Phase = 'loading' | 'title' | 'game';

function Background() {
  const images = useImages();
  const { mode } = useViewport();
  const url = imgUrl(images, mode === 'portrait' ? 'bg_portrait' : 'bg_base');
  return (
    <div
      className="bg"
      aria-hidden="true"
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
    />
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [images, setImages] = useState<ImageMap>({});
  const [saved, setSaved] = useState<GameState | null>(loadRun);
  const [initial, setInitial] = useState<GameState | null>(null);
  const [seed, setSeed] = useState(1);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      await initAssetRoots();
      initI18n(await loadLanguages());
      const result = await preloadAll(setProgress);
      await audio.prepare(result.audioData);
      setImages(result.images);
      setReady(true);
    })().catch(() => {
      // even on unexpected failure, let the player in (assets fall back individually)
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const onVis = () => audio.setHidden(document.hidden);
    const onHide = () => audio.setHidden(true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onVis);
    };
  }, []);

  const enter = useCallback(() => {
    void audio.resume();
    audio.startBgm();
    setPhase('title');
  }, []);

  const play = useCallback(() => {
    clearRun();
    setSaved(null);
    setInitial(null);
    setSeed((performance.now() * 1000) % 2147483647 | 0 || 1);
    setPhase('game');
  }, []);

  return (
    <AssetsContext.Provider value={images}>
      <main className="app">
        <Background />
        {phase === 'loading' && (
          <LoadingScreen progress={progress} ready={ready} onEnter={enter} />
        )}
        {phase === 'title' && <TitleScreen onPlay={play} canContinue={!!saved} onContinue={() => { setInitial(saved); setPhase('game'); }} />}
        {phase === 'game' && <GameScreen seed={seed} initialState={initial} />}
      </main>
    </AssetsContext.Provider>
  );
}
