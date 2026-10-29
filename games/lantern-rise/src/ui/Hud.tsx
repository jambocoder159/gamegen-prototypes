// In-game HUD: fuel meter (panel_meter frame + a solid fill inside its measured
// channel) and two info plates (distance, sparks) on panel_pill. The numeric
// distance/spark values and fill width use refs; the oil percentage and
// threshold warning update through React so their accessible state stays in sync.

import { useI18n } from '../i18n';
import { METER_CHANNEL } from '../config/layout';
import { AssetImg } from './atoms';
import type { HudRefs } from './GameCanvas';

export function Hud({ refs, fuel }: { refs: HudRefs; fuel: number }) {
  const { t } = useI18n();

  const ch = METER_CHANNEL;
  const channelStyle: React.CSSProperties = {
    left: `${ch.left * 100}%`,
    top: `${ch.top * 100}%`,
    width: `${(ch.right - ch.left) * 100}%`,
    height: `${(ch.bottom - ch.top) * 100}%`,
  };

  return (
    <div className="lr-hud">
      <div className={`lr-meter-wrap${fuel < 25 ? ' lr-oil-low' : ''}`}>
        <div className="lr-oil-label"><span>{t('oil')}</span><strong>{fuel}%</strong></div>
        <div className="lr-meter" role="progressbar" aria-label={t('a11y.fuel')}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={fuel}>
          <AssetImg k="panel_meter" className="lr-meter-frame" />
          <div className="lr-meter-channel" style={channelStyle}>
            <div className="lr-meter-fill" ref={refs.fuelFill} />
          </div>
        </div>
        <div className="lr-oil-warning" role="status" aria-live="polite">
          {fuel < 25 && <><span aria-hidden="true">⚠</span> {t('lowOil')}</>}
        </div>
      </div>

      <div className="lr-pills">
        <div className="lr-pill">
          <AssetImg k="panel_pill" className="lr-pill-bg" />
          <span className="lr-pill-content">
            <span className="lr-pill-label">{t('distance')}</span>
            <span className="lr-pill-value" ref={refs.distance}>
              0
            </span>
            <span className="lr-pill-unit">{t('metres')}</span>
          </span>
        </div>

        <div className="lr-pill">
          <AssetImg k="panel_pill" className="lr-pill-bg" />
          <span className="lr-pill-content">
            <span className="lr-sr-only">{t('sparks')}</span>
            <AssetImg k="icon_spark" className="lr-pill-icon" />
            <span className="lr-pill-value" ref={refs.sparks}>
              0
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
