// App shell: drives the preload gate (dicts first so the loading text can be
// localised, then media) and the screen state machine (loading -> title ->
// game). Resizing re-layouts live via the viewport hook without remounting.

import { useEffect, useState } from 'react';
import { loadDicts, preloadMedia, type LoadedMedia } from '../platform/loader';
import { I18nProvider } from '../i18n';
import type { Dict, LangCode } from '../i18n/langs';
import { AppProvider, useApp } from './AppContext';
import { useViewport, type Viewport } from '../platform/viewport';
import { audio } from '../platform/audio';
import { LoadingScreen } from '../ui/LoadingScreen';
import { TitleScreen } from '../ui/TitleScreen';
import { GameScreen } from '../ui/GameScreen';

type Screen = 'loading' | 'title' | 'game';

function Background({ viewport }: { viewport: Viewport }) {
  const { images } = useApp();
  const key = viewport.mode === 'portrait' ? 'bg_portrait' : 'bg_base';
  const img = images.get(key);
  if (!img) return <div className="lr-bg lr-bg-fallback" aria-hidden="true" />;
  return (
    <img
      className="lr-bg"
      src={img.currentSrc || img.src}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

function Stage({ viewport }: { viewport: Viewport }) {
  const [screen, setScreen] = useState<Screen>('loading');
  return (
    <div className={`lr-root lr-mode-${viewport.mode}`}>
      <Background viewport={viewport} />
      {screen === 'loading' && (
        <LoadingScreen progress={1} ready onEnter={() => setScreen('title')} />
      )}
      {screen === 'title' && <TitleScreen viewport={viewport} onPlay={() => setScreen('game')} />}
      {screen === 'game' && <GameScreen viewport={viewport} />}
    </div>
  );
}

export function App() {
  const viewport = useViewport();
  const [dicts, setDicts] = useState<Map<LangCode, Dict> | null>(null);
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await loadDicts();
      if (!alive) return;
      setDicts(d);
      const m = await preloadMedia((p) => {
        if (alive) setProgress(p);
      });
      if (!alive) return;
      setMedia(m);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Pause/resume audio with tab visibility (platform rule 7).
  useEffect(() => {
    const onVis = () => audio.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!dicts) return <div className="lr-boot" aria-hidden="true" />;

  return (
    <I18nProvider dicts={dicts}>
      {!media ? (
        <LoadingScreen progress={progress} ready={false} onEnter={() => {}} />
      ) : (
        <AppProvider images={media.images} imageOk={media.imageOk}>
          <Stage viewport={viewport} />
        </AppProvider>
      )}
    </I18nProvider>
  );
}
