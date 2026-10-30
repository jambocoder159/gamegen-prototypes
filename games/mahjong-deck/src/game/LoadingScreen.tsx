// Loading gate. Shows real overall progress as "Loading NN%"; when everything is
// ready the Enter button replaces the percentage in the same slot.
import { useI18n } from '../i18n';
import { Button } from './components/Button';
import { CatalogLink } from './components/CatalogLink';

export function LoadingScreen({
  progress,
  ready,
  onEnter,
}: {
  progress: number;
  ready: boolean;
  onEnter: () => void;
}) {
  const { t } = useI18n();
  const pct = Math.round(progress * 100);
  return (
    <div className="loading">
      <div className="loading__box">
        <div className="loading__title">{t('game.title')}</div>
        <div className="loading__slot">
          {ready ? (
            <Button className="btn btn--primary btn--enter" onClick={onEnter}>
              {t('loading.enter')}
            </Button>
          ) : (
            <span className="loading__pct">{t('loading.progress', { pct })}</span>
          )}
        </div>
        <CatalogLink />
      </div>
    </div>
  );
}
