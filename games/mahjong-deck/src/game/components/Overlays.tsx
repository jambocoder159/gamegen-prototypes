// Full-screen overlays: the between-stage reward (pick 1 of 3 cards), the victory
// screen (final/best score + hearts-as-stars + play again) and the defeat screen
// (score + retry). The dealer mascot appears on each. All controls are real
// <button>s with localised names.
import { useI18n } from '../../i18n';
import { MAX_HEARTS } from '../useGame';
import { CARDS, type CardKey } from '../cards';
import { Art } from './Art';
import { Button } from './Button';
import { Dealer } from './Dealer';

function Stars({ value }: { value: number }) {
  return (
    <div className="stars stars--lg" aria-hidden="true">
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <Art
          key={i}
          imgKey="iconStar"
          alt=""
          className={`stars__star${i < value ? '' : ' stars__star--off'}`}
        />
      ))}
    </div>
  );
}

export function RewardOverlay({
  rewards,
  reduced,
  cheer,
  onChoose,
  finale,
}: {
  rewards: CardKey[];
  finale: boolean;
  reduced: boolean;
  cheer: number;
  onChoose: (type: CardKey) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('reward.title')}>
      <div className="panel panel--reward">
        <Dealer cheer={cheer} reduced={reduced} className="panel__dealer" />
        <h2 className="panel__title">{t('reward.title')}</h2>
        <p className="panel__sub">{t('reward.pick')}</p>
        {finale && <p className="panel__sub">{t('reward.finale')}</p>}
        <ul className="reward__cards">
          {rewards.map((key, i) => {
            const def = CARDS[key];
            const name = t(def.nameKey);
            const effect = t(def.effectKey);
            return (
              <li key={`${key}-${i}`}>
                <Button
                  className="card card--reward"
                  dataCard={key}
                  title={t('a11y.rewardCard', { name, effect })}
                  onClick={() => onChoose(key)}
                >
                  <span className="card__art">
                    <Art imgKey={def.image} alt="" className="card__img" />
                  </span>
                  <span className="card__plate">
                    <span className="card__name">{name}</span>
                    <span className="card__effect">{effect}</span>
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function VictoryOverlay({
  score,
  best,
  hearts,
  reduced,
  cheer,
  onPlayAgain,
}: {
  score: number;
  best: number;
  hearts: number;
  reduced: boolean;
  cheer: number;
  onPlayAgain: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('victory.title')}>
      <div className="panel panel--result">
        <Dealer cheer={cheer} reduced={reduced} className="panel__dealer" />
        <h2 className="panel__title">{t('victory.title')}</h2>
        <Stars value={hearts} />
        <p className="panel__score">{t('victory.score', { n: score })}</p>
        <p className="panel__best">{t('victory.best', { n: best })}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onPlayAgain}>
            {t('buttons.playAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DefeatOverlay({
  score,
  best,
  reduced,
  onRetry,
}: {
  score: number;
  best: number;
  reduced: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('defeat.title')}>
      <div className="panel panel--result">
        <Dealer cheer={0} reduced={reduced} className="panel__dealer" />
        <h2 className="panel__title">{t('defeat.title')}</h2>
        <p className="panel__score">{t('victory.score', { n: score })}</p>
        <p className="panel__best">{t('victory.best', { n: best })}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" onClick={onRetry}>
            {t('buttons.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
}
