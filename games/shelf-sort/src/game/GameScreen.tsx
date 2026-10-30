// The playing screen: pills, the shelf board, the controls row (undo, restart,
// levels, sound, language), the clerk mascot and the win / level-picker overlays.
// Owns keyboard input: arrows move focus between slots, Enter/Space (native on
// the slot buttons) lift/place, Z undoes, R restarts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { SLOTS_PER_SHELF } from './logic';
import { useGame } from './useGame';
import { BoardView } from './components/BoardView';
import { Hud } from './components/Hud';
import { Clerk } from './components/Clerk';
import { Button, IconButton } from './components/Button';
import { SoundControl, LanguageControl } from './components/Controls';
import { WinOverlay, LevelPicker } from './components/Overlays';
import { Help, Announcer } from './components/A11y';
import { Coach } from './components/Coach';
import type { SavedRun } from './run';

const MAX_COLS: Record<Layout, number> = { portrait: 2, nearSquare: 3, wide: 3 };

export function GameScreen({
  layout,
  reduced,
  startLevel,
  resume,
}: {
  layout: Layout;
  reduced: boolean;
  startLevel: number;
  resume?: SavedRun;
}) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const game = useGame(manager, startLevel, resume);
  const { tapSlot, undo, restart, win } = game;
  const [picker, setPicker] = useState(false);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const total = game.level.S * SLOTS_PER_SHELF;

  const moveFocus = useCallback(
    (delta: number) => {
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement as HTMLElement | null;
      const cur = active?.dataset?.slot != null ? Number(active.dataset.slot) : -1;
      let next = cur < 0 ? 0 : cur + delta;
      next = Math.max(0, Math.min(total - 1, next));
      const btn = root.querySelector<HTMLButtonElement>(`[data-slot="${next}"]`);
      btn?.focus();
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('dialog')) return;
      if (win || picker) {
        if (e.key === 'Escape' && picker) setPicker(false);
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-SLOTS_PER_SHELF);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(SLOTS_PER_SHELF);
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          undo();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          restart();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveFocus, undo, restart, win, picker]);

  return (
    <div className={`game game--${layout}`} ref={rootRef}>
      <div className="game__hud">
        <Clerk cheer={game.cheer} reduced={reduced} className="hud__clerk" />
        <Hud level={game.level.number} moves={game.moves} />
      </div>

      <div className="game__board">
        <BoardView
          board={game.state.board}
          S={game.level.S}
          selected={game.selected}
          interactive={!win && !picker}
          reduced={reduced}
          clearFx={game.clearFx}
          invalidFx={game.invalidFx}
          hintSlot={coachStep === 0 ? game.state.board.findIndex(v => v !== null) :
            coachStep === 1 ? game.state.board.findIndex(v => v === null) : undefined}
          maxCols={MAX_COLS[layout]}
          onTap={tapSlot}
          ariaLabel={t('a11y.boardLabel')}
        />
      </div>

      <div className="game__controls">
        <IconButton imgKey="iconUndo" label={t('buttons.undo')} onClick={undo} />
        <IconButton imgKey="iconRestart" label={t('buttons.restart')} onClick={restart} />
        <Button className="btn btn--levels" onClick={() => setPicker(true)}>
          {t('buttons.levels')}
        </Button>
        <SoundControl />
        <LanguageControl />
      </div>

      <Coach event={game.event} picked={game.selected !== null} moved={game.moves > 0} onTarget={setCoachStep} />
      <Help />
      <Announcer event={game.event} />

      {win && (
        <WinOverlay
          win={win}
          levelNumber={game.level.number}
          reduced={reduced}
          onNext={game.nextLevel}
          onReplay={restart}
          onLevels={() => setPicker(true)}
        />
      )}
      {picker && (
        <LevelPicker
          levels={game.levels}
          progress={game.progress}
          current={game.level.number}
          onSave={game.persist}
          onPick={(n) => {
            game.gotoLevel(n);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}
