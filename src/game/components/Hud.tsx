// Stage / Score pills (gold plate, dark text ≥ 4.5:1) and the hearts row (five
// slots, filled up to the current count; the real count is in the group's
// accessible name). The combo pill is rendered separately over the board.
import { useI18n } from '../../i18n';
import { MAX_HEARTS } from '../useGame';
import { Art } from './Art';

function Pill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pill">
      <Art imgKey="pillGold" alt="" className="pill__plate" />
      <div className="pill__content">
        <span className="pill__label">{label}</span>
        <span className="pill__value">{value}</span>
      </div>
    </div>
  );
}

export function Hearts({ hearts }: { hearts: number }) {
  const { t } = useI18n();
  return (
    <div className="hearts" role="img" aria-label={t('hud.hearts', { n: hearts })}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <Art
          key={i}
          imgKey="iconHeart"
          alt=""
          className={`hearts__icon${i < hearts ? '' : ' hearts__icon--off'}`}
        />
      ))}
    </div>
  );
}

export function Hud({
  stage,
  stageCount,
  score,
  hearts,
  className,
}: {
  stage: number;
  stageCount: number;
  score: number;
  hearts: number;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className ? `hud ${className}` : 'hud'}>
      <Pill label={t('hud.stage')} value={`${stage}/${stageCount}`} />
      <Pill label={t('hud.score')} value={score} />
      <Hearts hearts={hearts} />
    </div>
  );
}

export function ComboPill({ combo }: { combo: number }) {
  const { t } = useI18n();
  return (
    <div className="combo-pill" role="status" aria-hidden="true">
      {t('hud.combo', { n: combo })}
    </div>
  );
}
