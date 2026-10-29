// The plant collection: a strip of all nine plant tiers. Tiers reached at least
// once show in full colour; undiscovered tiers are dimmed (opacity .35) and each
// carries an aria-label saying so, so it is not conveyed by colour alone. Purely
// informational (role="img"), not interactive.

import { useI18n } from '../../i18n';
import { plantImageKey } from '../../config/assets';
import { MAX_LEVEL } from '../../game/config';
import { Art } from './Art';

export function Collection({ maxLevel }: { maxLevel: number }) {
  const { t } = useI18n();
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  return (
    <ul className="dex" aria-label={t('dex.title')}>
      {levels.map((lv) => {
        const found = lv <= maxLevel;
        const name = t(`plant.${lv}`);
        const label = found
          ? t('dex.found', { name })
          : t('dex.missing', { name });
        return (
          <li key={lv} className={`dex__item${found ? '' : ' dex__item--locked'}`}>
            <span role="img" aria-label={label} className="dex__art">
              <Art imgKey={plantImageKey(lv)} alt="" className="dex__img" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
