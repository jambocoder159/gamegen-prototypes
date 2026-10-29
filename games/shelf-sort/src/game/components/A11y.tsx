// Screen-reader support: the in-game help text and a polite aria-live region that
// announces the result of each action. All strings are localised.
import { useI18n } from '../../i18n';
import type { GameEvent } from '../useGame';

export function Help() {
  const { t } = useI18n();
  return <p className="sr-only">{t('a11y.help')}</p>;
}

export function Announcer({ event }: { event: GameEvent | null }) {
  const { t } = useI18n();
  let message = '';
  if (event) {
    const name = event.name ? t(`goods.${event.name}`) : '';
    switch (event.kind) {
      case 'selected':
        message = t('a11y.selected', { name });
        break;
      case 'placed':
        message = t('a11y.placed', { name });
        break;
      case 'putDown':
        message = t('a11y.putDown', { name });
        break;
      case 'cleared':
        message = t('a11y.cleared', { name });
        break;
      case 'won':
        message = t('a11y.won', { moves: event.moves ?? 0, stars: event.stars ?? 0 });
        break;
      case 'nothing':
        message = t('a11y.nothing');
        break;
      case 'occupied':
        message = t('a11y.occupied');
        break;
    }
  }
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      <span key={event?.seq}>{message}</span>
    </div>
  );
}
