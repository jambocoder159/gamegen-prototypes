// Win overlay (star rating + Next / Replay / Levels, clerk cheering) and the
// level-picker overlay (12 levels, locked/unlocked, best stars).
import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n';
import { LEVEL_COUNT, type Level } from '../levels';
import type { Progress } from '../progress';
import type { WinInfo } from '../useGame';
import { Button } from './Button';
import { Art } from './Art';
import { CatalogLink } from './CatalogLink';

function Stars({ value, size }: { value: number; size: 'lg' | 'sm' }) {
  return (
    <div className={`stars stars--${size}`} aria-hidden>
      {[0, 1, 2].map((i) => (
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

export function WinOverlay({
  win,
  levelNumber,
  reduced,
  onNext,
  onReplay,
  onLevels,
}: {
  win: WinInfo;
  levelNumber: number;
  reduced: boolean;
  onNext: () => void;
  onReplay: () => void;
  onLevels: () => void;
}) {
  const { t } = useI18n();
  const canNext = levelNumber < LEVEL_COUNT;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('result.win')}>
      <div className="panel panel--win">
        <Art
          imgKey="clerk3"
          alt=""
          className={`panel__clerk${reduced ? '' : ' panel__clerk--cheer'}`}
        />
        <h2 className="panel__title">{t('result.win')}</h2>
        <Stars value={win.stars} size="lg" />
        <p className="panel__stars">{t('result.stars', { n: win.stars })}</p>
        <p className="panel__score">{t('result.score', { moves: win.moves, par: win.par })}</p>
        <div className="panel__actions">
          {canNext && (
            <Button className="btn btn--primary" onClick={onNext}>
              {t('buttons.next')}
            </Button>
          )}
          <Button className="btn" onClick={onReplay}>
            {t('buttons.replay')}
          </Button>
          <Button className="btn" onClick={onLevels}>
            {t('buttons.levels')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LevelPicker({
  levels,
  progress,
  current,
  onPick,
  onClose,
  onSave,
}: {
  levels: Level[];
  progress: Progress;
  current: number; // current level number
  onPick: (n: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={dialogRef} className="overlay overlay--modal" role="dialog" aria-modal="true" aria-label={t('levels.title')} onCancel={onClose}>
      <div className="panel panel--levels">
        <h2 className="panel__title">{t('levels.title')}</h2>
        <ul className="levelgrid">
          {levels.map((lv) => {
            const unlocked = lv.number <= progress.unlocked;
            const stars = progress.stars[lv.index];
            const isCurrent = lv.number === current;
            return (
              <li key={lv.number}>
                <Button
                  className={`levelcell${unlocked ? '' : ' levelcell--locked'}${isCurrent ? ' levelcell--current' : ''}`}
                  ariaLabel={
                    unlocked
                      ? `${t('levels.level', { n: lv.number })}, ${stars > 0 ? t('levels.best', { n: stars }) : t('levels.unplayed')}`
                      : `${t('levels.level', { n: lv.number })}, ${t('levels.locked')}`
                  }
                  onClick={() => unlocked && onPick(lv.number)}
                >
                  <span className="levelcell__n">{lv.number}</span>
                  <Stars value={unlocked ? stars : 0} size="sm" />
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="panel__actions">
          <Button className="btn" onClick={onClose}>
            {t('buttons.close')}
          </Button>
          <CatalogLink onSave={onSave} />
        </div>
      </div>
    </dialog>
  );
}
