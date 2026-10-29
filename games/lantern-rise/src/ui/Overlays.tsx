// Pause overlay and game-over result panel.

import { useI18n } from '../i18n';
import { AssetImg, TextButton } from './atoms';
import type { GameResult } from './GameCanvas';

export function PauseOverlay({ onResume }: { onResume: () => void }) {
  const { t } = useI18n();
  return (
    <div className="lr-overlay lr-pause" role="dialog" aria-modal="true" aria-label={t('paused')}>
      <div className="lr-panel">
        <h2 className="lr-panel-title">{t('paused')}</h2>
        <TextButton className="lr-primary" label={t('a11y.resume')} onClick={onResume}>
          {t('resume')}
        </TextButton>
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
