// The playing screen: HUD (stage/score/hearts), the tile board, the card hand,
// the controls row (restart, sound, language), the dealer mascot (side column
// only) and the reward / victory / defeat overlays. Owns keyboard input: arrows
// move focus between free tiles, Enter/Space select (native), 1–4 play hand
// cards, Z/H/S play the undo/hint/shuffle cards.
import { useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { STAGE_COUNT } from './layouts';
import { useGame } from './useGame';
import { BoardView } from './components/BoardView';
import { Hud, ComboPill } from './components/Hud';
import { Hand } from './components/Hand';
import { Dealer } from './components/Dealer';
import { IconButton } from './components/Button';
import { SoundControl, LanguageControl } from './components/Controls';
import { RewardOverlay, VictoryOverlay, DefeatOverlay } from './components/Overlays';
import { Help, Announcer } from './components/A11y';

export function GameScreen({ layout, reduced }: { layout: Layout; reduced: boolean }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const game = useGame(manager);
  const rootRef = useRef<HTMLDivElement>(null);
  const showDealer = layout !== 'portrait';

  const { tiles, playCard, hand, phase } = game;

  // Keyboard focus movement between free tiles (nearest in the pressed direction).
  const moveFocus = useCallback(
    (dx: number, dy: number) => {
      const root = rootRef.current;
      if (!root) return;
      const free = tiles.filter((tl) => !tl.removed);
      const centre = (tl: { x: number; y: number; z: number }) => ({
        cx: tl.x + 1 - tl.z * 0.2,
        cy: tl.y + 1 - tl.z * 0.24,
      });
      const active = document.activeElement as HTMLElement | null;
      const curId = active?.dataset?.tid != null ? Number(active.dataset.tid) : null;
      const cur = curId != null ? tiles.find((tl) => tl.id === curId) : null;
      const focusTile = (id: number) =>
        root.querySelector<HTMLButtonElement>(`[data-tid="${id}"]`)?.focus();

      if (!cur) {
        const first = root.querySelector<HTMLButtonElement>('.tile--free');
        first?.focus();
        return;
      }
      const from = centre(cur);
      let best: { id: number; score: number } | null = null;
      for (const tl of free) {
        if (tl.id === cur.id) continue;
        const btn = root.querySelector<HTMLButtonElement>(`[data-tid="${tl.id}"]`);
        if (!btn || btn.getAttribute('data-free') !== '1') continue;
        const c = centre(tl);
        const ddx = c.cx - from.cx;
        const ddy = c.cy - from.cy;
        // must be meaningfully in the requested direction
        const along = dx !== 0 ? ddx * dx : ddy * dy;
        if (along <= 0) continue;
        const across = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
        const score = along + across * 2;
        if (!best || score < best.score) best = { id: tl.id, score };
      }
      if (best) focusTile(best.id);
    },
    [tiles],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase !== 'playing') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(0, 1);
          break;
        case '1':
        case '2':
        case '3':
        case '4': {
          const idx = Number(e.key) - 1;
          if (hand[idx]) {
            e.preventDefault();
            playCard(hand[idx].type);
          }
          break;
        }
        case 'z':
        case 'Z':
          e.preventDefault();
          playCard('undo');
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          playCard('hint');
          break;
        case 's':
        case 'S':
          e.preventDefault();
          playCard('shuffle');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveFocus, playCard, hand, phase]);

  const interactive = phase === 'playing';

  return (
    <div className={`game game--${layout}`} ref={rootRef}>
      <div className="game__hud">
        <Hud
          stage={game.stage.number}
          stageCount={STAGE_COUNT}
          score={game.score}
          hearts={game.hearts}
        />
      </div>

      <div className="game__board">
        {game.comboActive && <ComboPill combo={game.combo} />}
        {game.wildActive && (
          <div className="wild-flag" role="status" aria-hidden="true">
            {t('hud.wild')}
          </div>
        )}
        <BoardView
          tiles={tiles}
          selected={game.selected}
          hint={game.hint}
          interactive={interactive}
          reduced={reduced}
          shakeId={game.shakeId}
          onTap={game.tapTile}
          ariaLabel={t('a11y.boardLabel')}
        />
      </div>

      {showDealer && (
        <div className="game__dealer">
          <Dealer cheer={game.cheer} reduced={reduced} />
        </div>
      )}

      <div className="game__hand">
        <Hand hand={hand} onPlay={(i) => hand[i] && playCard(hand[i].type)} disabled={!interactive} />
      </div>

      <div className="game__controls">
        <IconButton imgKey="iconRestart" label={t('buttons.restart')} onClick={game.restart} />
        <SoundControl />
        <LanguageControl />
      </div>

      <Help />
      <Announcer notice={game.notice} />

      {phase === 'reward' && game.rewards && (
        <RewardOverlay
          rewards={game.rewards}
          reduced={reduced}
          cheer={game.cheer}
          onChoose={game.chooseReward}
        />
      )}
      {phase === 'victory' && (
        <VictoryOverlay
          score={game.score}
          best={game.best}
          hearts={game.hearts}
          reduced={reduced}
          cheer={game.cheer}
          onPlayAgain={game.restart}
        />
      )}
      {phase === 'defeat' && (
        <DefeatOverlay score={game.score} best={game.best} reduced={reduced} onRetry={game.restart} />
      )}
    </div>
  );
}
