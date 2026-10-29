// Level / Moves pills: the supplied teal pill art is the plate, real text on top.
// White text on teal carries a solid outline for contrast (see .pill__value).
import { useI18n } from '../../i18n';
import { Art } from './Art';

function Pill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pill">
      <Art imgKey="pillTeal" alt="" className="pill__plate" />
      <div className="pill__content">
        <span className="pill__label">{label}</span>
        <span className="pill__value">{value}</span>
      </div>
    </div>
  );
}

export function Hud({
  level,
  moves,
  className,
}: {
  level: number;
  moves: number;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className ? `hud ${className}` : 'hud'}>
      <Pill label={t('hud.level')} value={level} />
      <Pill label={t('hud.moves')} value={moves} />
    </div>
  );
}
