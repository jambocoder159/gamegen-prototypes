import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Art } from './Art';
import type { MoveEvent } from '../useGame';

const KEY = 'mochi.coach';
function firstStep(): number | null {
  try { return localStorage.getItem(KEY) === 'done' ? null : 0; } catch { return 0; }
}
export function useCoach(event: MoveEvent | null) {
  const [step, setStep] = useState<number | null>(firstStep);
  const dismiss = () => {
    setStep(null);
    try { localStorage.setItem(KEY, 'done'); } catch { /* optional storage */ }
  };
  useEffect(() => {
    if (!event) return;
    setStep(previous => {
      if (previous === null) return null;
      if (previous === 0) return 1;
      if (!event.merged) return previous;
      try { localStorage.setItem(KEY, 'done'); } catch { /* optional storage */ }
      return null;
    });
  }, [event]);
  return { step, dismiss, reopen: () => setStep(0) };
}
export function Coach({ step, onDismiss }: { step: number | null; onDismiss: () => void }) {
  const { t } = useI18n();
  return <div className="coach" aria-live="polite" aria-atomic="true">
    {step !== null && <>
      <Art imgKey={step === 0 ? 'tile1' : 'tile2'} alt="" className="coach__icon" />
      <p className="coach__text"><span>{t('coach.step', { step: step + 1 })}</span>{t(step === 0 ? 'coach.slide' : 'coach.merge')}</p>
      <Button className="coach__skip" onClick={onDismiss} ariaLabel={t('coach.skip')}>×</Button>
    </>}
  </div>;
}
