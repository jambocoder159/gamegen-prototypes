// Title screen: the real game sorts itself behind the logo — the solver's actual
// move list for each level, played step by step, then on to the next level,
// endlessly. No HUD, no sfx. Logo + localised title on top; Play/Continue +
// language + sound at the bottom. "Continue" (to the highest unlocked level)
// replaces "Play" once progress exists.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Layout } from '../platform/layout';
import { applyMove, newGame, type GameState } from './logic';
import { solve } from './solver';
import { getLevels } from './levels';
import { loadProgress } from './progress';
import { BoardView } from './components/BoardView';
import { Button } from './components/Button';
import { LanguageControl, SoundControl } from './components/Controls';
import { Art } from './components/Art';
import type { ClearFx } from './useGame';

const MAX_COLS: Record<Layout, number> = { portrait: 2, nearSquare: 3, wide: 3 };
const STEP_MS = 650;
const LEVEL_PAUSE_MS = 1300;

interface Demo {
  idx: number;
  state: GameState;
  moves: ReturnType<typeof solve>;
  step: number;
}

function startDemo(idx: number): Demo {
  const levels = getLevels();
  const lv = levels[idx % levels.length];
  const state = newGame(lv.S, lv.K, lv.board);
  return { idx, state, moves: solve(lv.board), step: 0 };
}

export function TitleScreen({
  layout,
  reduced,
  onPlay,
}: {
  layout: Layout;
  reduced: boolean;
  onPlay: (level: number) => void;
}) {
  const { t } = useI18n();
  const progress = loadProgress();
  const hasProgress = progress.unlocked > 1;
  const demoRef = useRef<Demo>(startDemo(0));
  const [board, setBoard] = useState(() => demoRef.current.state.board.slice());
  const [S, setS] = useState(() => demoRef.current.state.S);
  const [clearFx, setClearFx] = useState<ClearFx | null>(null);
  const fxSeq = useRef(0);

  useEffect(() => {
    if (reduced) return; // no continuous ambient movement under reduced motion
    let timer = 0;
    const schedule = (ms: number) => {
      timer = window.setTimeout(tick, ms);
    };
    const tick = () => {
      const d = demoRef.current;
      const moves = d.moves;
      if (!moves || d.step >= moves.length) {
        // finished (or unsolvable) → next level after a pause
        const next = startDemo(d.idx + 1);
        demoRef.current = next;
        setBoard(next.state.board.slice());
        setS(next.state.S);
        setClearFx(null);
        schedule(STEP_MS);
        return;
      }
      const m = moves[d.step];
      const res = applyMove(d.state, m.from, m.to);
      d.step += 1;
      setBoard(d.state.board.slice());
      if (res.cleared.length > 0 && res.clearedType !== null) {
        fxSeq.current += 1;
        setClearFx({ seq: fxSeq.current, shelf: res.cleared[0], type: res.clearedType });
      }
      schedule(d.step >= moves.length ? LEVEL_PAUSE_MS : STEP_MS);
    };
    schedule(STEP_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (!clearFx) return;
    const id = window.setTimeout(() => setClearFx(null), 420);
    return () => window.clearTimeout(id);
  }, [clearFx]);

  return (
    <div className={`title title--${layout}`}>
      <div className="title__demo" aria-hidden>
        <BoardView
          board={board}
          S={S}
          selected={null}
          interactive={false}
          reduced={reduced}
          clearFx={clearFx}
          maxCols={MAX_COLS[layout]}
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
          <Button
            className="btn btn--primary btn--play"
            onClick={() => onPlay(hasProgress ? progress.unlocked : 1)}
          >
            {hasProgress ? t('buttons.continue') : t('buttons.play')}
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
