// Playable game screen. Owns pause/result state, the best score, the HUD refs,
// and an aria-live region for state announcements. Restart remounts GameCanvas
// via a changing key, which starts a fresh simulation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import type { Viewport } from '../platform/viewport';
import { loadBest, saveBest } from '../platform/storage';
import { GameCanvas, type GameResult, type HudRefs } from './GameCanvas';
import { Hud } from './Hud';
import { GameControls } from './Controls';
import { PauseOverlay, ResultPanel } from './Overlays';

export function GameScreen({ viewport }: { viewport: Viewport }) {
  const { images, reducedMotion } = useApp();
  const { t } = useI18n();

  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [best, setBest] = useState<number>(() => loadBest());
  const [isNewBest, setIsNewBest] = useState(false);
  const [announce, setAnnounce] = useState('');

  const distanceRef = useRef<HTMLSpanElement>(null);
  const sparksRef = useRef<HTMLSpanElement>(null);
  const fuelFillRef = useRef<HTMLDivElement>(null);
  const hudRefs: HudRefs = useMemo(
    () => ({ distance: distanceRef, sparks: sparksRef, fuelFill: fuelFillRef }),
    [],
  );

  const onOver = useCallback(
    (r: GameResult) => {
      setResult(r);
      let newBest = false;
      setBest((prev) => {
        if (r.score > prev) {
          newBest = true;
          saveBest(r.score);
          return r.score;
        }
        return prev;
      });
      setIsNewBest(newBest);
      setAnnounce(
        `${t('gameOver')}. ${t('distance')} ${r.distance} ${t('metres')}, ${t('sparks')} ${r.sparks}.` +
          (newBest ? ` ${t('newBest')}` : ''),
      );
    },
    [t],
  );

  const restart = useCallback(() => {
    setResult(null);
    setIsNewBest(false);
    setPaused(false);
    setAnnounce('');
    setGameKey((k) => k + 1);
  }, []);

  const togglePause = useCallback(() => {
    if (result) return;
    setPaused((p) => !p);
  }, [result]);

  // Pause the game (and audio via the hidden handler) when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) setPaused((p) => (result ? p : true));
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [result]);

  return (
    <div className="lr-screen lr-game">
      <GameCanvas
        key={gameKey}
        mode="play"
        viewport={viewport}
        images={images}
        reducedMotion={reducedMotion}
        seed={1 + gameKey}
        paused={paused || result !== null}
        playfieldLabel={t('a11y.playfield')}
        hud={hudRefs}
        onOver={onOver}
        onTogglePause={togglePause}
      />

      <Hud refs={hudRefs} />
      <GameControls paused={paused} onTogglePause={togglePause} onRestart={restart} />

      {paused && !result && <PauseOverlay onResume={togglePause} />}
      {result && (
        <ResultPanel result={result} best={best} isNewBest={isNewBest} onRestart={restart} />
      )}

      <div className="lr-sr-only" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
