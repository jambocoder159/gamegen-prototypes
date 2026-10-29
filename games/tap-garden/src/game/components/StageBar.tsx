// Stage progress bar: a flag, the stage number, a filled progress track (dew
// earned toward this stage's goal), and — on boss stages — a requirement chip
// showing the plant level you must also own (lock icon until satisfied). The
// progress value is mirrored into aria attributes for assistive tech.

import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import { plantImageKey } from '../../config/assets';
import { Art } from './Art';

export function StageBar({
  stage,
  earned,
  goal,
  isBoss,
  bossReq,
  bossMet,
}: {
  stage: number;
  earned: number;
  goal: number;
  isBoss: boolean;
  bossReq: number;
  bossMet: boolean;
}) {
  const { t } = useI18n();
  const pct = Math.max(0, Math.min(100, (earned / goal) * 100));
  return (
    <div className={`stagebar${isBoss ? ' stagebar--boss' : ''}`}>
      <div className="stagebar__head">
        <Art imgKey="iconFlag" alt="" className="stagebar__flag" />
        <span className="stagebar__label">
          {isBoss ? t('stage.boss', { n: stage }) : t('stage.label', { n: stage })}
        </span>
        {isBoss && (
          <span
            className={`stagebar__chip${bossMet ? ' stagebar__chip--met' : ''}`}
            title={t('stage.bossReq', { level: bossReq })}
          >
            {bossMet ? (
              <Art imgKey={plantImageKey(bossReq)} alt="" className="stagebar__chip-img" />
            ) : (
              <Art imgKey="iconLock" alt="" className="stagebar__chip-img" />
            )}
            <span className="stagebar__chip-text">{t('stage.reqLevel', { level: bossReq })}</span>
          </span>
        )}
      </div>
      <div
        className="stagebar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(pct)}
        aria-label={t('stage.progress', {
          n: stage,
          earned: formatNumber(earned),
          goal: formatNumber(goal),
        })}
      >
        <span className="stagebar__fill" style={{ width: `${pct}%` }} />
        <span className="stagebar__amount">
          {formatNumber(earned)} / {formatNumber(goal)}
        </span>
      </div>
    </div>
  );
}
