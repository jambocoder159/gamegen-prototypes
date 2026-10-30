// The playing screen: HUD, board, controls, overlays and a11y, arranged by the
// current layout. Owns keyboard input (arrows / WASD).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { useGame } from './useGame';
import { highestTier, type Dir } from './logic';
import type { SavedRun } from './storage';
import { Coach, useCoach } from './components/Coach';
import { Board } from './components/Board';
import { Hud } from './components/Hud';
import { Controls } from './components/Controls';
import { HelpDialog, WinBanner, ResultPanel } from './components/Overlays';
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

export function GameScreen({ layout, reduced, savedRun }: { layout: Layout; reduced: boolean; savedRun: SavedRun | null }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const game = useGame(manager, savedRun);
  const coach = useCoach(game.event);
  const { doMove, showWin } = game;
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpener = useRef<HTMLElement | null>(null);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEY_DIRS[e.key];
      if (!dir) return;
      e.preventDefault();
      if (showWin || helpOpen || (e.target as HTMLElement)?.closest('.lang')) return;
      doMove(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove, showWin, helpOpen]);

  return (
    <div className={`game game--${layout}`}>
      <div className="game__main" inert={showWin || game.state.over || helpOpen}>
        <div className="game__hud">
          <Hud score={game.state.score} best={game.best} newBest={game.newBest} highest={highestTier(game.state)} />
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
          <Controls onRestart={game.restart} onHelp={() => {
            helpOpener.current = document.activeElement as HTMLElement;
            coach.reopen();
            setHelpOpen(true);
          }} />
        </div>

        <div className="game__coach"><Coach step={coach.step} onDismiss={coach.dismiss} /></div>
      </div>

      <p className="sr-only">{t('a11y.help')}</p>
      <BoardSummary state={game.state} />
      <Announcer event={game.event} />

      {helpOpen && <HelpDialog onClose={closeHelp} onBeforeLeave={game.flush} returnFocus={helpOpener.current} />}

      {showWin && (
        <WinBanner
          onKeepGoing={() => game.dismissWin(true)}
          onNewGame={() => game.dismissWin(false)}
        />
      )}
      {game.state.over && !showWin && (
        <ResultPanel
          highest={highestTier(game.state)}
          score={game.state.score}
          best={game.best}
          newBest={game.newBest}
          onRestart={game.restart}
        />
      )}
    </div>
  );
}
