// Title screen: the real garden plays itself behind the logo — a bot driving the
// same logic module (tap the pot for dew, buy seeds when affordable, merge any
// matching pair), restarting whenever it reaches level 5 or 60s elapse. The demo
// runs on its own state and never touches the player's save or plays any sfx.
// Logo + localised title on top; Play + language + sound at the bottom. Under
// reduced motion the demo is a single static arrangement (no ambient movement).

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Layout } from '../platform/layout';
import { newGame, tap, buySeed, merge, tick, derive, hasEmptyPlot, type GameState } from './logic';
import { buyUpgrade } from './upgrades';
import { U } from './config';
import { PlotGrid } from './components/PlotGrid';
import { Mascot } from './components/Mascot';
import { Button } from './components/Button';
import { LanguageControl, SoundControl } from './components/Controls';
import { Art } from './components/Art';

const STEP_MS = 480;
const DT = STEP_MS / 1000;

// A fixed, pleasant arrangement shown when motion is reduced (no live demo).
const STATIC_PLOTS = [3, 0, 2, 1, 0, 4, 0, 2, 1, 0, 3, 0, 5, 2, 0, 1];

function firstMergePair(plots: number[]): [number, number] | null {
  for (let i = 0; i < plots.length; i++) {
    if (plots[i] === 0 || plots[i] >= 9) continue;
    for (let j = i + 1; j < plots.length; j++) {
      if (plots[j] === plots[i]) return [i, j];
    }
  }
  return null;
}

/** One bot decision: merge a pair, buy a seed or pot power when affordable, else
 * tap to earn dew. (The same v1 behaviours plus pot-power purchases.) */
function botStep(s: GameState): GameState {
  const pair = firstMergePair(s.plots);
  if (pair) return merge(s, pair[0], pair[1]).state;
  const d = derive(s);
  if (hasEmptyPlot(s) && s.dew >= d.seedCost) return buySeed(s).state;
  const powerCost = d.upgrades[U.power].cost;
  if (s.dew >= powerCost) return buyUpgrade(s, U.power, 'one').state;
  let st = s;
  for (let k = 0; k < 6; k++) st = tap(st).state;
  return st;
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
  const stateRef = useRef<GameState>(newGame());
  const [plots, setPlots] = useState<number[]>(() =>
    reduced ? STATIC_PLOTS.slice() : stateRef.current.plots.slice(),
  );
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (reduced) return; // no continuous ambient movement under reduced motion
    startRef.current = Date.now();
    const id = window.setInterval(() => {
      let s = stateRef.current;
      const elapsed = (Date.now() - startRef.current) / 1000;
      if (s.discovered >= 5 || elapsed > 60) {
        s = newGame(s.rng + 1); // vary the seed so each run differs
        startRef.current = Date.now();
      } else {
        s = tick(botStep(s), DT).state;
      }
      stateRef.current = s;
      setPlots(s.plots.slice());
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className={`title title--${layout}`}>
      <div className="title__demo" aria-hidden>
        <Mascot reduced={reduced} frame={1} className="title__pot" />
        <PlotGrid
          plots={plots}
          selected={null}
          interactive={false}
          reduced={reduced}
          popPlot={null}
        />
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
