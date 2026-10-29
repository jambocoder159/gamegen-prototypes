// Title screen: the real game plays itself behind the logo (greedy bot, one move
// every ~450 ms, restarting when stuck). No HUD, no result screen, no sfx. Logo
// + localised title on top, Play / language / sound at the bottom.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Layout } from '../platform/layout';
import { move, newGame, type GameState } from './logic';
import { chooseMove } from './bot';
import { Board } from './components/Board';
import { Button } from './components/Button';
import { LanguageControl, SoundControl } from './components/Controls';
import { Art } from './components/Art';

const MOVE_MS = 450;

// Separate, self-contained RNG for the demo (mulberry32); keeps the bot's seeds
// reproducible without pulling in Math.random at module scope.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function TitleScreen({
  layout,
  reduced,
  onPlay,
}: {
  layout: Layout;
  reduced: boolean;
  onPlay: () => void;
}) {
  const { t } = useI18n();
  const seedRef = useRef(0x1a2b3c4d);
  const rngRef = useRef(makeRng(seedRef.current));
  const [state, setState] = useState<GameState>(() => newGame(seedRef.current));

  useEffect(() => {
    if (reduced) return; // no continuous ambient movement under reduced motion
    const id = window.setInterval(() => {
      setState((prev) => {
        const dir = chooseMove(prev, rngRef.current);
        if (!dir) {
          seedRef.current = (seedRef.current * 1664525 + 1013904223) >>> 0;
          return newGame(seedRef.current);
        }
        const res = move(prev, dir);
        return res.changed ? res.state : prev;
      });
    }, MOVE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className={`title title--${layout}`}>
      <div className="title__demo" aria-hidden>
        <Board state={state} reduced={reduced} interactive={false} />
      </div>
      <div className="title__vignette" aria-hidden />
      <div className="title__content">
        <div className="title__head">
          <Art imgKey="logo" alt="" className="title__logo" />
          <h1 className="title__name">{t('game.title')}</h1>
          <p className="title__tagline">{t('game.tagline')}</p>
        </div>
        <div className="title__actions">
          <Button className="btn btn--primary btn--play" onClick={onPlay}>
            {t('buttons.play')}
          </Button>
          <div className="title__icons">
            <LanguageControl />
            <SoundControl />
          </div>
        </div>
      </div>
      <p className="sr-only">{t('a11y.titleDemo')}</p>
    </div>
  );
}
