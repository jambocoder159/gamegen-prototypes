// Pause overlay and game-over result panel.

import { useI18n } from '../i18n';
import { useEffect, useRef } from 'react';
import { AssetImg, CatalogLink, TextButton } from './atoms';
import type { GameResult } from './GameCanvas';

export function PauseOverlay({ onResume, onSave }: { onResume: () => void; onSave: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href]') ?? []);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const index = items.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
    };
    dialog?.addEventListener('keydown', trap);
    return () => {
      dialog?.removeEventListener('keydown', trap);
      const returnFocus = previous instanceof HTMLElement && previous !== document.body && previous.isConnected
        ? previous : document.querySelector<HTMLElement>('.lr-game .lr-glyphbtn');
      returnFocus?.focus();
    };
  }, []);
  return (
    <div ref={dialogRef} className="lr-overlay lr-pause" role="dialog" aria-modal="true" aria-label={t('paused')}>
      <div className="lr-panel">
        <h2 className="lr-panel-title">{t('paused')}</h2>
        <TextButton className="lr-primary" label={t('a11y.resume')} onClick={onResume}>
          {t('resume')}
        </TextButton>
        <CatalogLink onSave={onSave} />
      </div>
    </div>
  );
}

export function ResultPanel({
  result,
  best,
  isNewBest,
  onRestart,
}: {
  result: GameResult;
  best: number;
  isNewBest: boolean;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="lr-overlay lr-result" role="dialog" aria-modal="true" aria-label={t('gameOver')}>
      <div className="lr-panel">
        <h2 className="lr-panel-title">{t('gameOver')}</h2>
        {isNewBest && <p className="lr-newbest">{t('newBest')}</p>}
        <dl className="lr-stats">
          <div className="lr-stat">
            <dt>{t('distance')}</dt>
            <dd>
              {result.distance} {t('metres')}
            </dd>
          </div>
          <div className="lr-stat">
            <dt>
              <AssetImg k="icon_spark" className="lr-stat-icon" alt={t('sparks')} />
              {t('sparks')}
            </dt>
            <dd>{result.sparks}</dd>
          </div>
          <div className="lr-stat">
            <dt>{t('best')}</dt>
            <dd>{best}</dd>
          </div>
        </dl>
        <TextButton className="lr-primary" label={t('a11y.restart')} onClick={onRestart}>
          {t('restart')}
        </TextButton>
      </div>
    </div>
  );
}
