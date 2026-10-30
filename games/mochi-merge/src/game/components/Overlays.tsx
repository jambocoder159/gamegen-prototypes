// Win banner and game-over result panel overlays.
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Art } from './Art';
import { tileImageKey } from '../../config/assets';
import { useEffect, useRef } from 'react';
import { CatalogLink } from './CatalogLink';

/** The existing ? control opens help without adding anything to the HUD. */
export function HelpDialog({ onClose, onBeforeLeave, returnFocus }: {
  onClose: () => void; onBeforeLeave: () => void; returnFocus: HTMLElement | null;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = ref.current;
    panel?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        const controls = panel?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocus?.focus();
    };
  }, [onClose, returnFocus]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('coach.help')} ref={ref}>
      <div className="panel panel--help">
        <h2 className="panel__title">{t('coach.help')}</h2>
        <p className="panel__body">{t('a11y.help')}</p>
        <p className="panel__body">{t('coach.merge')}</p>
        <div className="panel__actions">
          <Button className="btn" onClick={onClose}>{t('buttons.close')}</Button>
          <CatalogLink onBeforeLeave={onBeforeLeave} />
        </div>
      </div>
    </div>
  );
}

export function WinBanner({
  onKeepGoing,
  onNewGame,
}: {
  onKeepGoing: () => void;
  onNewGame: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('result.win')}>
      <div className="panel panel--win">
        <h2 className="panel__title">{t('result.win')}</h2>
        <p className="panel__body">{t('result.winBody')}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" autoFocus onClick={onKeepGoing}>
            {t('buttons.keepGoing')}
          </Button>
          <Button className="btn" onClick={onNewGame}>
            {t('buttons.newGame')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel({
  score,
  best,
  newBest,
  highest,
  onRestart,
}: {
  score: number;
  best: number;
  newBest: boolean;
  highest: number;
  onRestart: () => void;
}) {
  const { t, tier } = useI18n();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('result.gameOver')}>
      <div className="panel panel--result">
        <Art imgKey={tileImageKey(highest)} alt="" className="panel__mascot" />
        <p className="panel__highest">{t('result.highest', { name: tier(highest), number: highest })}</p>
        <h2 className="panel__title">{t('result.gameOver')}</h2>
        {newBest && <p className="panel__newbest">{t('result.newBest')}</p>}
        <p className="panel__score">{t('result.finalScore', { score })}</p>
        <p className="panel__best">{t('result.bestScore', { best })}</p>
        <div className="panel__actions">
          <Button className="btn btn--primary" autoFocus onClick={onRestart}>
            {t('buttons.restart')}
          </Button>
        </div>
      </div>
    </div>
  );
}
