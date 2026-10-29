// Score / Best pills: the supplied pill art is the plate, with real text on top.
import { useI18n } from '../../i18n';
import { Art } from './Art';
import type { ImageKey } from '../../config/assets';

function Pill({
  imgKey,
  label,
  value,
  highlight,
}: {
  imgKey: ImageKey;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`pill${highlight ? ' pill--best' : ''}`}>
      <Art imgKey={imgKey} alt="" className="pill__plate" />
      <div className="pill__content">
        <span className="pill__label">{label}</span>
        <span className="pill__value">{value}</span>
      </div>
    </div>
  );
}

export function Hud({
  score,
  best,
  newBest,
  className,
  highest,
}: {
  score: number;
  best: number;
  highest: number;
  newBest?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className ? `hud-wrap ${className}` : 'hud-wrap'}>
      <div className="hud">
        <Pill imgKey="pillPink" label={t('hud.score')} value={score} />
        <Pill imgKey="pillMint" label={t('hud.best')} value={best} highlight={newBest} />
      </div>
      <div className={`goal${highest >= 9 ? ' goal--reached' : ''}`}>
        <Art imgKey="tile9" alt="" className="goal__icon" />
        <div className="goal__text"><strong>{t('hud.goal')}</strong><span>{t('hud.progress', { highest, needed: 9 })}</span>
          <progress max={9} value={Math.min(highest, 9)} aria-label={t('hud.goal')} />
        </div>
      </div>
    </div>
  );
}
