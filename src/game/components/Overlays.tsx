// Modal overlays: the "welcome back" offline-earnings greeting, the once-only
// Golden World Tree celebration, and the reset-progress confirmation. Each is a
// real dialog with a localised accessible name; Escape / the close button
// dismiss. Focus moves to the dialog's primary button on open.

import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n';
import { formatDew } from '../format';
import { Button } from './Button';
import { Art } from './Art';
import { Mascot } from './Mascot';

function useAutoFocus() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

export function OfflineDialog({ amount, onCollect }: { amount: number; onCollect: () => void }) {
  const { t, lang } = useI18n();
  const btnRef = useAutoFocus();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('offline.title')}>
      <div className="panel">
        <h2 className="panel__title">{t('offline.title')}</h2>
        <div className="panel__reward">
          <Art imgKey="iconDew" alt="" className="panel__dew" />
          <span className="panel__amount">{formatDew(amount, lang)}</span>
        </div>
        <p className="panel__text">{t('offline.body')}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onCollect} buttonRef={btnRef}>
            {t('offline.collect')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CelebrationOverlay({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const btnRef = useAutoFocus();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('celebrate.title')}>
      <div className="panel panel--celebrate">
        <Mascot reduced={reduced} className="panel__mascot" />
        <Art imgKey="plant9" alt="" className="panel__tree" />
        <h2 className="panel__title">{t('celebrate.title')}</h2>
        <p className="panel__text">{t('celebrate.body')}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onClose} buttonRef={btnRef}>
            {t('celebrate.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResetConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const btnRef = useAutoFocus();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('reset.title')}>
      <div className="panel">
        <h2 className="panel__title">{t('reset.title')}</h2>
        <p className="panel__text">{t('reset.body')}</p>
        <div className="panel__actions">
          <Button className="btn" onClick={onCancel} buttonRef={btnRef}>
            {t('reset.cancel')}
          </Button>
          <Button className="btn btn--danger" onClick={onConfirm}>
            {t('reset.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
