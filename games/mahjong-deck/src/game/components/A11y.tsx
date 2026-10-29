// Screen-reader support: the localised in-game help text (documents the keys) and
// a polite aria-live region that announces the result of each action. Plus a small
// VISIBLE notice shown near the board when the player taps a blocked tile.
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import type { Notice } from '../useGame';

export function Help() {
  const { t } = useI18n();
  return <p className="sr-only">{t('a11y.help')}</p>;
}

// Visible, transient toast over the board explaining why a tapped tile is blocked
// (covered vs side-blocked). It's an aria-live region so it's also announced.
export function BoardNotice({ notice }: { notice: Notice | null }) {
  const { t } = useI18n();
  const [shown, setShown] = useState<{ seq: number; text: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const key =
      notice.kind === 'blockedCovered'
        ? 'notice.covered'
        : notice.kind === 'blockedSide'
          ? 'notice.side'
          : null;
    if (!key) { setShown(null); return; }
    setShown({ seq: notice.seq, text: t(key) });
    const id = window.setTimeout(() => {
      setShown((cur) => (cur && cur.seq === notice.seq ? null : cur));
    }, 1600);
    return () => window.clearTimeout(id);
  }, [notice, t]);

  return (
    <div className="board-notice" role="status" aria-live="polite" aria-atomic="true">
      {shown ? <span className="board-notice__chip">{shown.text}</span> : null}
    </div>
  );
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
      case 'blockedCovered':
        message = t('notice.covered');
        break;
      case 'blockedSide':
        message = t('notice.side');
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
