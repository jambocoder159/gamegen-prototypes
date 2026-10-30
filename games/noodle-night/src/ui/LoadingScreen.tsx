import { useI18n } from '../i18n/index';
import { useImages, imgUrl } from './assets-context';
import { PlateButton } from './controls';

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
  const images = useImages();
  const logo = imgUrl(images, 'logo');
  const pct = Math.round(progress * 100);

  return (
    <div className="screen loading-screen">
      <div className="loading-logo">
        {logo ? (
          <img draggable={false} src={logo} alt={t('title')} className="logo-img" />
        ) : (
          <div className="logo-fallback" aria-hidden="true" />
        )}
      </div>
      <h1 className="game-title">{t('title')}</h1>
      <div className="enter-slot">
        {ready ? (
          <PlateButton className="enter-btn" onClick={onEnter} autoFocus>
            {t('enter')}
          </PlateButton>
        ) : (
          <div className="loading-text" role="status" aria-live="polite">
            {t('loading', { pct })}
          </div>
        )}
      </div>
    </div>
  );
}
