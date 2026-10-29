// Screen-reader support: a hidden board summary (updated every render) and a
// polite aria-live region that announces the result of each move. All text is
// localised.
import { useI18n } from '../../i18n';
import { GRID, type GameState } from '../logic';
import type { MoveEvent } from '../useGame';

export function BoardSummary({ state }: { state: GameState }) {
  const { t, tier } = useI18n();
  const names: string[] = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const cell = state.grid[r][c];
      names.push(cell ? tier(cell.tier) : t('a11y.empty'));
    }
  return <div className="sr-only">{t('a11y.boardSummary', { cells: names.join(', ') })}</div>;
}

export function Announcer({ event }: { event: MoveEvent | null }) {
  const { t, tier } = useI18n();
  let message = '';
  if (event) {
    if (event.over) message = t('a11y.gameOver', { score: event.score });
    else if (event.reachedWin) message = t('a11y.win', { score: event.score });
    else if (event.merged)
      message = t('a11y.moveMerged', { name: tier(event.mergedTier), score: event.score });
    else message = t('a11y.moveNoMerge', { score: event.score });
  }
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
