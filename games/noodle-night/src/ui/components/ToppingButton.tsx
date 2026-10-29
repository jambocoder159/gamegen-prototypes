import { useImages, imgUrl } from '../assets-context';
import { useI18n } from '../../i18n/index';
import { Btn } from '../Btn';
import type { Topping } from '../../game/logic';
import type { ImageKey } from '../../config/assets';

export function ToppingButton({
  topping,
  index,
  inBowl,
  interactive,
  onToggle,
}: {
  topping: Topping;
  index: number;
  inBowl: boolean;
  interactive: boolean;
  onToggle: (t: Topping) => void;
}) {
  const images = useImages();
  const { t } = useI18n();
  const plate = imgUrl(images, 'panel_button');
  const icon = imgUrl(images, topping as ImageKey);
  const name = t(`toppings.${topping}`);

  return (
    <Btn
      className={`plate-btn topping-btn${inBowl ? ' on' : ''}`}
      onClick={() => onToggle(topping)}
      disabled={!interactive}
      silent={!interactive}
      aria-pressed={inBowl}
      tabIndex={interactive ? 0 : -1}
    >
      {plate ? (
        <img className="plate-bg" src={plate} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <span className="img-fallback plate-fb" aria-hidden="true" />
      )}
      <span className="topping-key" aria-hidden="true">
        {index + 1}
      </span>
      <span className="topping-face">
        {icon ? (
          <img className="topping-icon" src={icon} alt="" aria-hidden="true" draggable={false} />
        ) : (
          <span className="img-fallback" aria-hidden="true" />
        )}
        <span className="plate-label topping-label">{name}</span>
      </span>
      <span className="topping-check" aria-hidden="true">
        {inBowl ? '✓' : ''}
      </span>
    </Btn>
  );
}
