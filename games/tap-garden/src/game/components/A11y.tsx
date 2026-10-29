// Screen-reader support: the in-game help/keys text, a polite live region that
// announces the result of each action, and a separate polite region for the dew
// total (refreshed at most once per second so it does not chatter).
import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import type { GameEvent } from '../useGarden';

export function Help() {
  const { t } = useI18n();
  return <p className="sr-only">{t('a11y.help')}</p>;
}

export function Announcer({ event }: { event: GameEvent | null }) {
  const { t } = useI18n();
  let message = '';
  if (event) {
    const name = event.level ? t(`plant.${event.level}`) : '';
    switch (event.kind) {
      case 'selected':
        message = t('a11y.selected', { name, level: event.level ?? 0 });
        break;
      case 'deselected':
        message = t('a11y.deselected');
        break;
      case 'moved':
        message = t('a11y.moved');
        break;
      case 'merged':
        message = t('a11y.merged', { name, level: event.level ?? 0 });
        break;
      case 'newMax':
        message = t('a11y.newMax', { name, level: event.level ?? 0 });
        break;
      case 'bought':
        message = t('a11y.bought');
        break;
      case 'freeSeed':
        message = t('a11y.freeSeed');
        break;
      case 'full':
        message = t('a11y.full');
        break;
      case 'nothing':
        message = t('a11y.nothing');
        break;
    }
  }
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message ? `${message} ` : ''}
    </div>
  );
}

export function DewLive({ dew }: { dew: number }) {
  const { t } = useI18n();
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {t('a11y.dewTotal', { n: formatNumber(dew) })}
    </div>
  );
}
