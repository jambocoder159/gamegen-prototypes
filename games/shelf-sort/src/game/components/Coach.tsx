import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import type { GameEvent } from '../useGame';
import { Art } from './Art';
import { Button } from './Button';

const KEY = 'shelf-sort.coach.v1';
function firstVisit() {
  try { return localStorage.getItem(KEY) !== 'done'; } catch { return true; }
}

export function Coach({ event, picked, moved, onTarget }: {
  event: GameEvent | null;
  picked: boolean;
  moved: boolean;
  onTarget: (step: number | null) => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<number | null>(() => firstVisit() ? (picked ? 1 : moved ? 2 : 0) : null);
  const finish = () => {
    setStep(null);
    try { localStorage.setItem(KEY, 'done'); } catch { /* optional preference */ }
  };
  useEffect(() => { onTarget(step); }, [step, onTarget]);
  useEffect(() => {
    if (!event) return;
    if (event.kind === 'cleared' || event.kind === 'won') finish();
    else if (event.kind === 'selected') setStep(s => s === 0 ? 1 : s);
    else if (event.kind === 'placed') setStep(s => s === 1 ? 2 : s);
    else if (event.kind === 'putDown') setStep(s => s === 1 ? 0 : s);
  }, [event]);
  return (
    <div className={`game__coach${step === null ? ' game__coach--closed' : ''}`}>
      <Button className="icon-btn help-btn" ariaLabel={t('buttons.help')} onClick={() => setStep(picked ? 1 : 0)}>?</Button>
      {step !== null && <>
        <Art imgKey={step === 2 ? 'iconStar' : 'goodsMilk'} alt="" className="coach__icon" />
        <p className="coach__copy" aria-live="polite" aria-atomic="true">
          <strong>{step + 1}/3</strong> {t(`coach.step${step + 1}`)}
        </p>
        <Button className="btn coach__skip" onClick={finish}>{t('buttons.skip')}</Button>
        <p className="coach__keys">{t('coach.keys')}</p>
      </>}
    </div>
  );
}
