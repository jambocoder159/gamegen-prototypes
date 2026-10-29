import { useImages, imgUrl } from '../assets-context';
import { useI18n } from '../../i18n/index';
import { CONFIG, comboMultiplier, type GameState } from '../../game/logic';

export function Hud({ state }: { state: GameState }) {
  const images = useImages();
  const { t } = useI18n();
  const heart = imgUrl(images, 'heart');
  const coin = imgUrl(images, 'coin');
  const mult = comboMultiplier(state.combo);

  return (
    <div className="hud">
      <div className="hud-hearts" role="img" aria-label={`${t('lives')}: ${state.hearts}`}>
        {Array.from({ length: CONFIG.maxHearts }, (_, i) => {
          const alive = i < state.hearts;
          return (
            <span key={i} className={`heart${alive ? '' : ' lost'}`} aria-hidden="true">
              {heart ? <img src={heart} alt="" /> : <span className="img-fallback heart-fb" />}
            </span>
          );
        })}
      </div>

      <div className="hud-coins" aria-label={`${t('coins')}: ${state.coins}`}>
        {coin ? <img src={coin} alt="" aria-hidden="true" /> : <span className="img-fallback coin-fb" />}
        <span className="hud-coins-num">{state.coins}</span>
      </div>

      <div
        className={`hud-combo${state.combo >= 2 ? ' active' : ''}`}
        aria-label={`${t('combo')}: ${state.combo}`}
      >
        <span className="hud-combo-label">{t('combo')}</span>
        <span className="hud-combo-num">
          {state.combo}
          {mult > 1 ? <span className="hud-combo-mult"> ×{mult.toFixed(2).replace(/0$/, '')}</span> : null}
        </span>
      </div>
    </div>
  );
}
