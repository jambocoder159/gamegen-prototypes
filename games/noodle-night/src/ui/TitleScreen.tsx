// Title screen: the real game runs behind the logo, played by the bot, endlessly
// restarting. No HUD, no result screen, no sfx (BGM only, started on the enter
// gesture). Logo + localised title on top, Play / language / sound at the bottom.

import { useEffect, useReducer, useRef } from 'react';
import { useI18n } from '../i18n/index';
import { useViewport, usePrefersReducedMotion } from '../platform/layout';
import { useImages, imgUrl } from './assets-context';
import { PlayField } from './PlayField';
import { SoundButton, LangButton, PlateButton } from './controls';
import { createGame, step, drainEvents, type GameState } from '../game/logic';
import { loadBest } from '../game/storage';
import { createBot, stepBot, type BotState } from '../game/bot';
import { CatalogLink } from './CatalogLink';

function makeSeed(): number {
  return (performance.now() * 1000) % 2147483647 | 0 || 1;
}

export function TitleScreen({ onPlay, onContinue, canContinue }: { onPlay: () => void; onContinue: () => void; canContinue: boolean }) {
  const { t } = useI18n();
  const { mode } = useViewport();
  const reduced = usePrefersReducedMotion();
  const images = useImages();
  const logo = imgUrl(images, 'logo');

  const stateRef = useRef<GameState>(createGame(makeSeed()));
  const botRef = useRef<BotState>(createBot());
  const chefFrame = useRef(1);
  const chefAccum = useRef(0);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let seed = (makeSeed() ^ 0x9e3779b9) >>> 0;
    const rnd = () => {
      // small deterministic PRNG so the demo never pulls on the game's own RNG
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (s.status === 'playing') {
        step(s, dt);
        stepBot(s, botRef.current, dt, rnd);
        if (!reduced) {
          chefAccum.current += dt;
          if (chefAccum.current >= 0.2) {
            chefAccum.current = 0;
            chefFrame.current = (chefFrame.current % 4) + 1;
          }
        }
      } else {
        stateRef.current = createGame(makeSeed());
        botRef.current = createBot();
        chefFrame.current = 1;
      }
      drainEvents(s); // discard — the title demo is silent
      force();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className={`screen title-screen mode-${mode}`}>
      <div className="demo-field" aria-hidden="true">
        <PlayField
          state={stateRef.current}
          interactive={false}
          reducedMotion={reduced}
          chefFrame={chefFrame.current}
          mode={mode}
        />
      </div>
      <div className="vignette" aria-hidden="true" />
      <p className="sr-only">{t('aria.demo')}</p>

      <div className="title-overlay">
        <div className="title-brand">
          {logo ? (
            <img className="title-logo" src={logo} alt="" aria-hidden="true" draggable={false} />
          ) : (
            <div className="logo-fallback" aria-hidden="true" />
          )}
          <div className="title-copy">
            <h1 className="game-title">{t('title')}</h1>
            <p className="game-tagline">{t('tagline')}</p>
            <p className="title-best">{t('bestScore')}: <strong>{loadBest()}</strong></p>
          </div>
        </div>

        <div className="title-navigation">
          <div className="title-actions">
            <LangButton />
            <div className="title-play-actions">
              {canContinue && <PlateButton className="continue-btn" onClick={onContinue} autoFocus>{t('continue')}</PlateButton>}
              <PlateButton className="play-btn" onClick={onPlay} autoFocus={!canContinue}>
                {t(canContinue ? 'newGame' : 'play')}
              </PlateButton>
            </div>
            <SoundButton />
          </div>
          <CatalogLink />
        </div>
      </div>
    </div>
  );
}
