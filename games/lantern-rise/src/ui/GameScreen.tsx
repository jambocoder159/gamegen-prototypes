// Playable game screen. Owns pause/result state, the best score, the HUD refs,
// and an aria-live region for state announcements. Restart remounts GameCanvas
// via a changing key, which starts a fresh simulation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import type { Viewport } from '../platform/viewport';
import { clearRun, coachSeen, markCoachSeen, loadBest, saveBest } from '../platform/storage';
import { GameCanvas, type GameResult, type HudRefs, type PlayStatus } from './GameCanvas';
import type { GameSim } from '../game/logic';
import { AssetImg, TextButton } from './atoms';
import { Hud } from './Hud';
import { GameControls } from './Controls';
import { PauseOverlay, ResultPanel } from './Overlays';

export function GameScreen({ viewport, initialSim }: { viewport: Viewport; initialSim?: GameSim | null }) {
  const { images, reducedMotion } = useApp();
  const { t } = useI18n();

  const [gameKey, setGameKey] = useState(0);
  const saveBeforeLeave = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(!!initialSim);
  const [result, setResult] = useState<GameResult | null>(null);
  const [best, setBest] = useState<number>(() => loadBest());
  const [isNewBest, setIsNewBest] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [resumeSim, setResumeSim] = useState(initialSim);
  const [status, setStatus] = useState<PlayStatus>({ fuel: 100, countdown: 3, time: 0, sparks: 0 });
  const [coach, setCoach] = useState(() => coachSeen() ? -1 : 0);
  const closeCoach = useCallback(() => { markCoachSeen(); setCoach(-1); }, []);
  const onAction = useCallback((action: 'hold' | 'release') => {
    setCoach((step) => step === 0 && action === 'hold' ? 1 : step === 1 && action === 'release' ? 2 : step);
  }, []);
  useEffect(() => {
    if (coach === 2 && status.sparks > 0) closeCoach();
  }, [coach, status.sparks, closeCoach]);
  const coachOpen = coach >= 0;
  useEffect(() => {
    if (!coachOpen) return;
    const timer = window.setTimeout(closeCoach, 30000);
    return () => window.clearTimeout(timer);
  }, [coachOpen, closeCoach]);
  useEffect(() => { if (result) closeCoach(); }, [result, closeCoach]);

  const distanceRef = useRef<HTMLSpanElement>(null);
  const sparksRef = useRef<HTMLSpanElement>(null);
  const fuelFillRef = useRef<HTMLDivElement>(null);
  const hudRefs: HudRefs = useMemo(
    () => ({ distance: distanceRef, sparks: sparksRef, fuelFill: fuelFillRef }),
    [],
  );

  const onOver = useCallback(
    (r: GameResult) => {
      clearRun();
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
    clearRun();
    setResumeSim(null);
    setStatus({ fuel: 100, countdown: 3, time: 0, sparks: 0 });
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
        initialSim={resumeSim}
        onStatus={setStatus}
        onAction={onAction}
        paused={paused || result !== null}
        playfieldLabel={t('a11y.playfield')}
        hud={hudRefs}
        onOver={onOver}
        onTogglePause={togglePause}
        saveBeforeLeave={saveBeforeLeave}
      />

      <Hud refs={hudRefs} fuel={status.fuel} />
      <GameControls paused={paused} onTogglePause={togglePause} onRestart={restart} onHelp={() => { setCoach(0); }} />

      {status.countdown > 0 && !paused && !result && <div className="lr-countdown" role="status" aria-live="polite">
        <span>{t('ready')}</span><strong>{status.countdown}</strong>
      </div>}
      {coach >= 0 && !paused && !result && <aside className="lr-coach" aria-label={t('coach.open')}>
        <div className="lr-coach-message" role="status" aria-live="polite">
          {coach === 2 ? <AssetImg k="icon_spark" className="lr-coach-icon" /> : <span aria-hidden="true">{coach === 0 ? '↑' : '↓'}</span>}
          <span>{t(`coach.step${coach + 1}`)}</span>
        </div>
        <TextButton className="lr-coach-skip" onClick={closeCoach}>{t('coach.skip')}</TextButton>
      </aside>}

      {paused && !result && <PauseOverlay onResume={togglePause} onSave={() => saveBeforeLeave.current?.()} />}
      {result && (
        <ResultPanel result={result} best={best} isNewBest={isNewBest} onRestart={restart} />
      )}

      <div className="lr-sr-only" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
