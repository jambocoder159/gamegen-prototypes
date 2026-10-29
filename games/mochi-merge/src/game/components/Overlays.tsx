// Win banner and game-over result panel overlays.
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Art } from './Art';
import { tileImageKey } from '../../config/assets';

export function WinBanner({
  onKeepGoing,
  onNewGame,
}: {
  onKeepGoing: () => void;
  onNewGame: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('result.win')}>
      <div className="panel panel--win">
        <h2 className="panel__title">{t('result.win')}</h2>
        <p className="panel__body">{t('result.winBody')}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" autoFocus onClick={onKeepGoing}>
            {t('buttons.keepGoing')}
          </Button>
          <Button className="btn" onClick={onNewGame}>
            {t('buttons.newGame')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel({
  score,
  best,
  newBest,
  highest,
  onRestart,
}: {
  score: number;
  best: number;
  newBest: boolean;
  highest: number;
  onRestart: () => void;
}) {
  const { t, tier } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('result.gameOver')}>
      <div className="panel panel--result">
        <Art imgKey={tileImageKey(highest)} alt="" className="panel__mascot" />
        <p className="panel__highest">{t('result.highest', { name: tier(highest), number: highest })}</p>
        <h2 className="panel__title">{t('result.gameOver')}</h2>
        {newBest && <p className="panel__newbest">{t('result.newBest')}</p>}
        <p className="panel__score">{t('result.finalScore', { score })}</p>
        <p className="panel__best">{t('result.bestScore', { best })}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" autoFocus onClick={onRestart}>
            {t('buttons.restart')}
          </Button>
        </div>
      </div>
    </div>
  );
}
