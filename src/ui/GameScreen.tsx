// The interactive game: owns the rAF loop (delta-time), input (pointer + keyboard),
// audio for game events, the aria-live announcements, and the result panel.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { translate, useI18n } from '../i18n/index';
import { audio } from '../platform/audio';
import { useViewport, usePrefersReducedMotion } from '../platform/layout';
import { Btn } from './Btn';
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

const BEST_KEY = 'noodle_night_best';

function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    /* ignore */
  }
}

function makeSeed(): number {
  return (performance.now() * 1000) % 2147483647 | 0 || 1;
}

export function GameScreen({ seed }: { seed: number }) {
  const { t } = useI18n();
  const { mode } = useViewport();
  const reduced = usePrefersReducedMotion();

  const stateRef = useRef<GameState>(createGame(seed));
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [live, setLive] = useState('');
  const [over, setOver] = useState(false);
  const [help, setHelp] = useState(false);

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
    stateRef.current = createGame(seed);
    chefFrame.current = 1;
    newBest.current = false;
    setOver(false);
    setLive('');
    force();
  }, [seed]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.coins > best.current) {
      best.current = s.coins;
      newBest.current = true;
      saveBest(s.coins);
    }
    setLive(translate('aria.liveOver', { score: s.coins }));
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
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = stateRef.current;
      if (s.status === 'playing' && !pausedRef.current) {
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
      force();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, react]);

  // ---- actions ----
  const doToggle = useCallback((tp: Topping) => {
    const r = toggleTopping(stateRef.current, tp);
    if (r !== 'none') audio.playSfx('sfx_add');
    force();
  }, []);

  const doClear = useCallback(() => {
    if (clearBowl(stateRef.current)) {
      audio.playSfx('sfx_add');
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
          : translate('aria.liveWrong'),
      );
    }
    force();
  }, []);

  const doSelect = useCallback((id: number) => {
    selectCustomer(stateRef.current, id);
    force();
  }, []);

  const restart = useCallback(() => {
    stateRef.current = createGame(makeSeed());
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
      if (s.status !== 'playing') return;
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
        force();
        e.preventDefault();
      } else if (k === 'ArrowRight') {
        cycleSelection(s, 1);
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
            aria-expanded={help}
            onClick={() => setHelp((v) => !v)}
          >
            <span className="help-glyph" aria-hidden="true">
              ?
            </span>
          </Btn>
          <LangButton />
          <SoundButton />
        </div>
      </div>

      <PlayField
        state={s}
        interactive={s.status === 'playing'}
        reducedMotion={reduced}
        chefFrame={chefFrame.current}
        mode={mode}
        onToggle={doToggle}
        onClear={doClear}
        onServe={doServe}
        onSelect={doSelect}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>

      {help && (
        <div className="overlay help-overlay" role="dialog" aria-label={t('help.title')}>
          <div className="panel help-panel">
            <h2>{t('help.title')}</h2>
            <p>{t('help.body')}</p>
            <div className="panel-actions">
              <RestartButton onClick={restart} />
              <PlateButton className="panel-btn" onClick={() => setHelp(false)} autoFocus>
                {t('play')}
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
