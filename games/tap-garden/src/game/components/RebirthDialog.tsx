// The Rebirth dialog: shows the sun coins this rebirth would grant, what is kept
// vs reset, and a confirm button. When the garden has not yet reached stage 10 the
// confirm button is disabled and explains how many stages remain.

import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import { REBIRTH_STAGE } from '../config';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Art } from './Art';
import type { UseGarden } from '../useGarden';

export function RebirthDialog({
  g,
  onClose,
}: {
  g: UseGarden;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const d = g.d;
  const available = d.rebirthAvailable;
  const remaining = Math.max(0, REBIRTH_STAGE - g.snap.maxStage);

  const keep = ['coins', 'relics', 'codex', 'bestStage'];
  const reset = ['dew', 'plants', 'plots', 'upgrades', 'stage'];

  const confirm = () => {
    const res = g.rebirth();
    if (res.ok) onClose();
  };

  return (
    <Dialog
      title={t('rebirth.title')}
      onClose={onClose}
      className="dialog--rebirth"
      titleIcon={<Art imgKey="iconRebirth" alt="" className="dialog__title-icon" />}
    >
      <div className="rebirth__preview">
        <Art imgKey="iconSuncoin" alt="" className="rebirth__coin" />
        <span className="rebirth__amount">{formatNumber(d.rebirthCoins)}</span>
        <span className="rebirth__coin-label">{t('rebirth.coinsGained')}</span>
      </div>

      <p className="rebirth__body">{t('rebirth.body')}</p>

      <div className="rebirth__lists">
        <div className="rebirth__col rebirth__col--keep">
          <h3 className="rebirth__h">{t('rebirth.keepTitle')}</h3>
          <ul>
            {keep.map((k) => (
              <li key={k}>{t(`rebirth.keep.${k}`)}</li>
            ))}
          </ul>
        </div>
        <div className="rebirth__col rebirth__col--reset">
          <h3 className="rebirth__h">{t('rebirth.resetTitle')}</h3>
          <ul>
            {reset.map((k) => (
              <li key={k}>{t(`rebirth.reset.${k}`)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rebirth__actions">
        {available ? (
          <Button className="btn btn--primary rebirth__confirm" onClick={confirm}>
            <Art imgKey="iconRebirth" alt="" className="btn__dew" />
            {t('rebirth.confirm')}
          </Button>
        ) : (
          <>
            <Button className="btn rebirth__confirm" onClick={() => {}} dimmed>
              <Art imgKey="iconLock" alt="" className="btn__dew" />
              {t('rebirth.confirm')}
            </Button>
            <p className="rebirth__need">{t('rebirth.need', { n: remaining })}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
