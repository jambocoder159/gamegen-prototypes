// The interactive game: owns the rAF loop (delta-time), input (pointer + keyboard),
// audio for game events, the aria-live announcements, and the result panel.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { translate, useI18n } from '../i18n/index';
import { audio } from '../platform/audio';
import { useViewport, usePrefersReducedMotion } from '../platform/layout';
import { Btn } from './Btn';
import { StepGuide } from './components/StepGuide';
import { clearRun, loadBest, saveBest, saveRun, needsCoach, rememberCoach } from '../game/storage';
import { Hud } from './components/Hud';
import { PlayField } from './PlayField';
import { SoundButton, LangButton, RestartButton, PlateButton } from './controls';
import {
  createGame,
  step,
  serve,
  toggleTopping,
  clearBowl,
  selectCustomer,
  cycleSelection,
  drainEvents,
  TOPPINGS,
  type GameState,
  type GameEvent,
  type Topping,
} from '../game/logic';

function makeSeed(): number {
  return (performance.now() * 1000) % 2147483647 | 0 || 1;
}

export function GameScreen({ seed, initialState }: { seed: number; initialState: GameState | null }) {
  const { t } = useI18n();
  const { mode } = useViewport();
  const reduced = usePrefersReducedMotion();

  const stateRef = useRef<GameState>(initialState ?? createGame(seed));
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [live, setLive] = useState('');
  const [over, setOver] = useState(false);
  const [help, setHelp] = useState(false);
  const [coach, setCoach] = useState<number | null>(() => needsCoach() ? 0 : null);
  const [feedback, setFeedback] = useState('');

  const chefFrame = useRef(1);
  const chefAccum = useRef(0);
  const best = useRef(loadBest());
  const newBest = useRef(false);

  // The help panel doubles as pause: the loop freezes while it is open.
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = help;
  }, [help]);

  // Fresh game whenever the seed changes (initial mount + "play again").
  useEffect(() => {
    stateRef.current = initialState ?? createGame(seed);
    rememberCoach();
    saveRun(stateRef.current);
    chefFrame.current = 1;
    newBest.current = false;
    setOver(false);
    setLive('');
    force();
  }, [seed, initialState]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.coins > best.current) {
      best.current = s.coins;
      newBest.current = true;
      saveBest(s.coins);
    }
    setLive(translate('aria.liveOver', { score: s.coins }));
    clearRun();
    setCoach(null);
    setFeedback('');
    setOver(true);
  }, []);

  const react = useCallback(
    (e: GameEvent) => {
      switch (e) {
        case 'ok':
          audio.playSfx('sfx_ok');
          break;
        case 'wrong':
          audio.playSfx('sfx_wrong');
          break;
        case 'leave_angry':
          audio.playSfx('sfx_wrong');
          setLive(translate('aria.liveLeft'));
          break;
        case 'over':
          audio.playSfx('sfx_over');
          endGame();
          break;
      }
    },
    [endGame],
  );

  // Main loop: delta-time step, chef animation, event reactions.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSaved = last;
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = stateRef.current;
      if (s.status === 'playing' && !pausedRef.current && !document.hidden) {
        step(s, dt);
        if (!reduced) {
          chefAccum.current += dt;
          if (chefAccum.current >= 0.2) {
            chefAccum.current = 0;
            chefFrame.current = (chefFrame.current % 4) + 1;
          }
        }
      }
      const events = drainEvents(s);
      for (const e of events) react(e);
      if (now - lastSaved >= 1000) { saveRun(s); lastSaved = now; }
      force();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, react]);

  useEffect(() => {
    const persist = () => saveRun(stateRef.current);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', persist);
    return () => {
      persist();
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', persist);
    };
  }, []);

  // ---- actions ----
  const doToggle = useCallback((tp: Topping) => {
    const r = toggleTopping(stateRef.current, tp);
    if (r !== 'none') {
      audio.playSfx('sfx_add');
      setCoach((v) => v !== null ? 2 : null);
      setFeedback('');
      saveRun(stateRef.current);
    }
    force();
  }, []);

  const doClear = useCallback(() => {
    if (clearBowl(stateRef.current)) {
      audio.playSfx('sfx_add');
      setFeedback('');
      saveRun(stateRef.current);
      force();
    }
  }, []);

  const doServe = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'playing') return;
    audio.playSfx('sfx_serve');
    const r = serve(s);
    if (r) {
      setLive(
        r.ok
          ? translate('aria.liveServed', { coins: r.coins, combo: r.combo })
          : translate(r.incomplete ? (s.bowl.length ? 'incompleteBowl' : 'emptyBowl') : 'aria.liveWrong'),
      );
    }
    if (r?.incomplete) setFeedback(s.bowl.length ? 'incompleteBowl' : 'emptyBowl');
    else if (r) { setFeedback(''); if (r.ok) setCoach(null); }
    saveRun(s);
    force();
  }, []);

  const doSelect = useCallback((id: number) => {
    selectCustomer(stateRef.current, id);
    setCoach((v) => v === 0 ? 1 : v);
    saveRun(stateRef.current);
    force();
  }, []);

  const restart = useCallback(() => {
    clearRun();
    stateRef.current = createGame(makeSeed());
    saveRun(stateRef.current);
    setFeedback('');
    setCoach(null);
    chefFrame.current = 1;
    newBest.current = false;
    pausedRef.current = false;
    setHelp(false);
    setOver(false);
    setLive('');
    force();
  }, []);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.status !== 'playing' || pausedRef.current || document.hidden) return;
      const k = e.key;
      if (k >= '1' && k <= '6') {
        doToggle(TOPPINGS[Number(k) - 1]);
        e.preventDefault();
      } else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        const ae = document.activeElement;
        if (ae && ae.tagName === 'BUTTON') return; // let the focused button act
        doServe();
        e.preventDefault();
      } else if (k === 'c' || k === 'C' || k === 'Backspace') {
        doClear();
        e.preventDefault();
      } else if (k === 'ArrowLeft') {
        cycleSelection(s, -1);
        setCoach((v) => v === 0 ? 1 : v);
        saveRun(s);
        force();
        e.preventDefault();
      } else if (k === 'ArrowRight') {
        cycleSelection(s, 1);
        setCoach((v) => v === 0 ? 1 : v);
        saveRun(s);
        force();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doToggle, doServe, doClear]);

  const s = stateRef.current;

  return (
    <div className={`screen game-screen mode-${mode}${reduced ? ' reduced' : ''}`}>
      <div className="top-bar">
        <Hud state={s} />
        <div className="utility-bar">
          <Btn
            className="icon-btn help-btn"
            aria-label={t('help.title')}
            aria-expanded={coach !== null}
            disabled={over}
            onClick={() => { setCoach(0); rememberCoach(); }}
          >
            <span className="help-glyph" aria-hidden="true">
              ?
            </span>
          </Btn>
          <Btn className="icon-btn pause-btn" aria-label={t('help.pause')} disabled={over} onClick={() => { pausedRef.current = true; setHelp(true); }}>
            <span aria-hidden="true">Ⅱ</span>
          </Btn>
          <LangButton />
          <SoundButton />
        </div>
      </div>

      {coach !== null && !feedback && !over && <StepGuide active={coach} onSkip={() => { setCoach(null); rememberCoach(); }} />}
      {feedback && !over && <p className="bowl-feedback" role="status">{t(feedback)}</p>}

      {!over && <PlayField
        state={s}
        interactive={s.status === 'playing' && !help}
        reducedMotion={reduced}
        chefFrame={chefFrame.current}
        mode={mode}
        onToggle={doToggle}
        onClear={doClear}
        onServe={doServe}
        onSelect={doSelect}
      />}

      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>

      {help && (
        <div className="overlay help-overlay" role="dialog" aria-label={t('help.title')}>
          <div className="panel help-panel">
            <h2>{t('help.title')}</h2>
            <StepGuide />
            <p className="keyboard-help">{t('help.keys', { serve: t('serve') })}</p>
            <div className="panel-actions">
              <RestartButton onClick={restart} />
              <PlateButton className="panel-btn" onClick={() => { pausedRef.current = false; setHelp(false); }} autoFocus>
                {t('help.resume')}
              </PlateButton>
            </div>
          </div>
        </div>
      )}

      {over && (
        <div className="overlay result-overlay" role="dialog" aria-label={t('gameOver')}>
          <div className="panel result-panel">
            <h2>{t('gameOver')}</h2>
            {newBest.current && <p className="new-best">{t('newBest')}</p>}
            <dl className="result-stats">
              <div>
                <dt>{t('coins')}</dt>
                <dd>{s.coins}</dd>
              </div>
              <div>
                <dt>{t('served')}</dt>
                <dd>{s.served}</dd>
              </div>
              <div>
                <dt>{t('bestCombo')}</dt>
                <dd>{s.bestCombo}</dd>
              </div>
              <div>
                <dt>{t('bestScore')}</dt>
                <dd>{best.current}</dd>
              </div>
            </dl>
            <PlateButton className="panel-btn" onClick={restart} autoFocus>
              {t('restart')}
            </PlateButton>
          </div>
        </div>
      )}
    </div>
  );
}
