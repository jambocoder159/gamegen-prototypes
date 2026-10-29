import { useImages, imgUrl } from '../assets-context';
import { useI18n } from '../../i18n/index';
import { Btn } from '../Btn';
import { BOWL, BOWL_SLOTS } from '../../config/layout';
import type { Topping } from '../../game/logic';
import type { ImageKey } from '../../config/assets';

export function Bowl({
  bowl,
  onClear,
  reducedMotion,
  interactive,
}: {
  bowl: Topping[];
  onClear: () => void;
  reducedMotion: boolean;
  interactive: boolean;
}) {
  const images = useImages();
  const { t } = useI18n();
  const bowlUrl = imgUrl(images, 'bowl');

  const list = bowl.map((x) => t(`toppings.${x}`)).join(', ');
  const label = bowl.length ? t('aria.bowlHas', { list }) : t('aria.bowl');

  return (
    <Btn
      className="bowl"
      onClick={onClear}
      aria-label={label}
      disabled={!interactive}
      silent={!interactive}
      tabIndex={interactive ? 0 : -1}
    >
      {bowlUrl ? (
        <img className="bowl-img" src={bowlUrl} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <span className="img-fallback bowl-fb" aria-hidden="true" />
      )}
      <span className="bowl-toppings" aria-hidden="true">
        {bowl.map((tpg, i) => {
          const slot = BOWL_SLOTS[Math.min(i, BOWL_SLOTS.length - 1)];
          const left = (BOWL.broth.cx + slot.x * BOWL.broth.rx) * 100;
          const top = (BOWL.broth.cy + slot.y * BOWL.broth.ry) * 100;
          const url = imgUrl(images, tpg as ImageKey);
          return (
            <span
              key={tpg}
              className={`bowl-topping${reducedMotion ? '' : ' pop'}`}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {url ? <img src={url} alt="" draggable={false} /> : <span className="img-fallback" />}
            </span>
          );
        })}
      </span>
    </Btn>
  );
}
