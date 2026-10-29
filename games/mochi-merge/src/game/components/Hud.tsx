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
}: {
  score: number;
  best: number;
  newBest?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className ? `hud ${className}` : 'hud'}>
      <Pill imgKey="pillPink" label={t('hud.score')} value={score} />
      <Pill imgKey="pillMint" label={t('hud.best')} value={best} highlight={newBest} />
    </div>
  );
}
