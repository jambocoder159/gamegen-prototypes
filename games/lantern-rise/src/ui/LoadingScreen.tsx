// Preload gate. Shows the logo and a single status row: while media is loading
// it reads "Loading NN%" (localised); once ready the Enter button replaces the
// percentage in the same row. Pressing Enter is the user gesture that resumes
// the AudioContext and starts BGM.

import { useI18n } from '../i18n';
import { audio } from '../platform/audio';
import { CatalogLink } from './atoms';

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

  const enter = () => {
    void audio.resume().then(() => {
      audio.startBgm();
    });
    onEnter();
  };

  return (
    <div className="lr-screen lr-loading">
      <div className="lr-loading-inner">
        <h1 className="lr-title-text">{t('title')}</h1>
        <p className="lr-tagline">{t('tagline')}</p>
        <div className="lr-status-row">
          {ready ? (
            <button
              type="button"
              className="lr-textbtn lr-primary lr-enter"
              aria-label={t('enter')}
              onPointerEnter={() => audio.play('sfx_hover', 0.3)}
              onClick={() => {
                audio.play('sfx_click', 0.5);
                enter();
              }}
            >
              {t('enter')}
            </button>
          ) : (
            <span className="lr-status-text" role="status" aria-live="polite">
              {t('loading', { pct })}
            </span>
          )}
        </div>
        <CatalogLink />
      </div>
    </div>
  );
}
