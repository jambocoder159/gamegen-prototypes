// In-game HUD: fuel meter (panel_meter frame + a solid fill inside its measured
// channel) and two info plates (distance, sparks) on panel_pill. The numeric
// values and the fill width are mutated imperatively by GameCanvas via the
// forwarded refs, so the HUD never re-renders during play.

import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import { METER_CHANNEL } from '../config/layout';
import { AssetImg } from './atoms';
import type { HudRefs } from './GameCanvas';

export function Hud({ refs }: { refs: HudRefs }) {
  const { t } = useI18n();
  const { images } = useApp();
  const meter = images.get('panel_meter');

  const ch = METER_CHANNEL;
  const channelStyle: React.CSSProperties = {
    left: `${ch.left * 100}%`,
    top: `${ch.top * 100}%`,
    width: `${(ch.right - ch.left) * 100}%`,
    height: `${(ch.bottom - ch.top) * 100}%`,
  };

  return (
    <div className="lr-hud" aria-hidden="true">
      <div className="lr-meter-wrap">
        <div
          className="lr-meter"
          style={meter ? { aspectRatio: `${meter.naturalWidth} / ${meter.naturalHeight}` } : undefined}
        >
          <AssetImg k="panel_meter" className="lr-meter-frame" />
          <div className="lr-meter-channel" style={channelStyle}>
            <div className="lr-meter-fill" ref={refs.fuelFill} />
          </div>
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
