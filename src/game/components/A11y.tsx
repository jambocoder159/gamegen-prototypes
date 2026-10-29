// Screen-reader support: the localised in-game help text (documents the keys) and
// a polite aria-live region that announces the result of each action.
import { useI18n } from '../../i18n';
import type { Notice } from '../useGame';

export function Help() {
  const { t } = useI18n();
  return <p className="sr-only">{t('a11y.help')}</p>;
}

export function Announcer({ notice }: { notice: Notice | null }) {
  const { t } = useI18n();
  let message = '';
  if (notice) {
    switch (notice.kind) {
      case 'match':
        message = t('a11y.match', { n: notice.n ?? 0 });
        break;
      case 'mismatch':
        message = t('a11y.mismatch', { n: notice.n ?? 0 });
        break;
      case 'stageClear':
        message = t('a11y.stageClear', { n: notice.n ?? 0 });
        break;
      case 'reshuffleCard':
        message = t('a11y.reshuffleCard');
        break;
      case 'reshuffleHeart':
        message = t('a11y.reshuffleHeart', { n: notice.n ?? 0 });
        break;
      case 'noPair':
        message = t('a11y.noPair');
        break;
      case 'cardHint':
        message = t('a11y.cardHint');
        break;
      case 'cardShuffle':
        message = t('a11y.cardShuffle');
        break;
      case 'cardUndo':
        message = t('a11y.cardUndo');
        break;
      case 'cardWild':
        message = t('a11y.cardWild');
        break;
      case 'cardCombo':
        message = t('a11y.cardCombo');
        break;
      case 'heal':
        message = t('a11y.heal', { n: notice.n ?? 0 });
        break;
      case 'victory':
        message = t('a11y.victory');
        break;
      case 'defeat':
        message = t('a11y.defeat');
        break;
    }
  }
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message ? `${message} ` : ''}
    </div>
  );
}
