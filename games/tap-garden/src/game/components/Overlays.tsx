// Modal overlays: the "welcome back" offline-earnings greeting, the once-only
// Golden World Tree celebration, and the reset-progress confirmation. Each is a
// real dialog with a localised accessible name; Escape / the close button
// dismiss. Focus moves to the dialog's primary button on open.

import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import { Button } from './Button';
import { Art } from './Art';
import { Mascot } from './Mascot';
import type { GameState } from '../logic';
import { OfflineRatio } from './GardenExtras';
import { Dialog } from './Dialog';

export function OfflineDialog({ state, amount, onCollect }: { state: GameState; amount: number; onCollect: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('offline.title')} onClose={onCollect}>
      <div className="panel-content">
        <div className="panel__reward">
          <Art imgKey="iconDew" alt="" className="panel__dew" />
          <span className="panel__amount">{formatNumber(amount)}</span>
        </div>
        <p className="panel__text">{t('offline.body')}</p>
        <OfflineRatio state={state} />
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onCollect}>
            {t('offline.collect')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function CelebrationOverlay({ reduced, onClose }: { reduced: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('celebrate.title')} onClose={onClose}>
      <div className="panel-content panel--celebrate">
        <Mascot reduced={reduced} className="panel__mascot" />
        <Art imgKey="plant9" alt="" className="panel__tree" />
        <p className="panel__text">{t('celebrate.body')}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onClose}>
            {t('celebrate.continue')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ResetConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('reset.title')} onClose={onCancel}>
      <div className="panel-content">
        <p className="panel__text">{t('reset.body')}</p>
        <div className="panel__actions">
          <Button className="btn" onClick={onCancel}>
            {t('reset.cancel')}
          </Button>
          <Button className="btn btn--danger" onClick={onConfirm}>
            {t('reset.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
