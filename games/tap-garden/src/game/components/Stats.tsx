// The two info pills: dew balance (gold plate) and dew-per-second (green plate).
// The supplied clay pill art is the plate; real text rides on top in white with a
// dark clay stroke for ≥4.5:1 contrast. The dew pill carries a numeric data-dew
// attribute so automated tests can read the raw value.

import { useI18n } from '../../i18n';
import { formatDew, formatRate } from '../format';
import { Art } from './Art';
import type { ImageKey } from '../../config/assets';

function Pill({
  plate,
  icon,
  label,
  value,
  className,
  dataDew,
}: {
  plate: ImageKey;
  icon: ImageKey;
  label: string;
  value: string;
  className?: string;
  dataDew?: number;
}) {
  return (
    <div className={`pill ${className ?? ''}`} data-dew={dataDew}>
      <Art imgKey={plate} alt="" className="pill__plate" />
      <div className="pill__content">
        <Art imgKey={icon} alt="" className="pill__icon" />
        <span className="pill__text">
          <span className="pill__label">{label}</span>
          <span className="pill__value">{value}</span>
        </span>
      </div>
    </div>
  );
}

export function Stats({
  dew,
  rate,
  className,
}: {
  dew: number;
  rate: number;
  className?: string;
}) {
  const { t, lang } = useI18n();
  return (
    <div className={className ? `stats ${className}` : 'stats'}>
      <Pill
        plate="pillGold"
        icon="iconDew"
        label={t('hud.dew')}
        value={formatDew(dew, lang)}
        className="pill--dew"
        dataDew={Math.floor(dew)}
      />
      <Pill
        plate="pillGreen"
        icon="iconDew"
        label={t('hud.rate')}
        value={t('hud.perSec', { n: formatRate(rate, lang) })}
        className="pill--rate"
      />
    </div>
  );
}
