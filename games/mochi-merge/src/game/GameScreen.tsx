// The playing screen: HUD, board, controls, overlays and a11y, arranged by the
// current layout. Owns keyboard input (arrows / WASD).
import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { useGame } from './useGame';
import type { Dir } from './logic';
import { Board } from './components/Board';
import { Hud } from './components/Hud';
import { Controls } from './components/Controls';
import { WinBanner, ResultPanel } from './components/Overlays';
import { BoardSummary, Announcer } from './components/A11y';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
};

export function GameScreen({ layout, reduced }: { layout: Layout; reduced: boolean }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const game = useGame(manager);
  const { doMove, showWin } = game;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEY_DIRS[e.key];
      if (!dir) return;
      e.preventDefault();
      if (showWin) return; // win banner is modal
      doMove(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove, showWin]);

  return (
    <div className={`game game--${layout}`}>
      <div className="game__hud">
        <Hud score={game.state.score} best={game.best} newBest={game.newBest} />
      </div>

      <div className="game__board">
        <Board
          state={game.state}
          reduced={reduced}
          interactive={!showWin && !game.state.over}
          onMove={doMove}
          ariaLabel={t('a11y.boardLabel')}
        />
      </div>

      <div className="game__controls">
        <Controls onRestart={game.restart} />
      </div>

      <p className="sr-only">{t('a11y.help')}</p>
      <BoardSummary state={game.state} />
      <Announcer event={game.event} />

      {showWin && (
        <WinBanner
          onKeepGoing={() => game.dismissWin(true)}
          onNewGame={() => game.dismissWin(false)}
        />
      )}
      {game.state.over && (
        <ResultPanel
          score={game.state.score}
          best={game.best}
          newBest={game.newBest}
          reduced={reduced}
          onRestart={game.restart}
        />
      )}
    </div>
  );
}
