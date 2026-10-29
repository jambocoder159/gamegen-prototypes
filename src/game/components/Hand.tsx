// The player's hand: up to four ability-card stacks. Each is a real <button>
// showing the card art, a count badge (real text), and the localised name +
// short effect on a cream plate so the text always reads ≥ 4.5:1. The slot number
// (1–4) doubles as the keyboard shortcut and is shown as a small chip.
import { useI18n } from '../../i18n';
import { CARDS, type HandCard } from '../cards';
import { Art } from './Art';
import { Button } from './Button';

export function Hand({
  hand,
  onPlay,
  disabled,
}: {
  hand: HandCard[];
  onPlay: (index: number) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul className="hand" aria-label={t('a11y.handLabel')}>
      {hand.map((card, i) => {
        const def = CARDS[card.type];
        const name = t(def.nameKey);
        const effect = t(def.effectKey);
        return (
          <li key={card.type} className="hand__slot">
            <Button
              className="card"
              dataCard={card.type}
              onClick={() => !disabled && onPlay(i)}
            >
              <span className="card__key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="card__art">
                <Art imgKey={def.image} alt="" className="card__img" />
                <span className="card__badge" aria-hidden="true">
                  ×{card.count}
                </span>
              </span>
              <span className="card__plate">
                <span className="card__name">{name}</span>
                <span className="card__effect">{effect}</span>
                <span className="sr-only">{t('a11y.card', { key: i + 1, n: card.count })}</span>
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
