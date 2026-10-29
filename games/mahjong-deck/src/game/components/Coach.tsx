import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Art } from './Art';
const KEY = 'mahjong-deck.coach';
function firstVisit() { try { return localStorage.getItem(KEY) !== '1'; } catch { return true; } }
export function useCoach(selected: number | null, score: number, handCount: number) {
  const [step, setStep] = useState(() => firstVisit() ? 0 : -1);
  const [baseline, setBaseline] = useState(handCount);
  const finish = () => { setStep(-1); try { localStorage.setItem(KEY, '1'); } catch { /* unavailable */ } };
  useEffect(() => { if (step === 0 && selected !== null) setStep(1); }, [step, selected]);
  useEffect(() => { if (step === 1 && score > 0) { setBaseline(handCount); setStep(2); } }, [step, score, handCount]);
  useEffect(() => { if (step === 2 && handCount < baseline) finish(); }, [step, handCount, baseline]);
  return { step, finish, reopen: () => { setBaseline(handCount); setStep(0); } };
}
export function Coach({ step, onSkip }: { step: number; onSkip: () => void }) {
  const { t } = useI18n();
  if (step < 0) return null;
  return <aside className="coach" aria-label={t('coach.help')}>
    <Art imgKey={step === 2 ? 'cardHint' : 'tileBamboo'} alt="" className="coach__icon" />
    <p aria-live="polite" aria-atomic="true">{t(`coach.step${step + 1}`)}</p>
    <Button className="btn coach__skip" onClick={onSkip}>{t('coach.skip')}</Button>
  </aside>;
}
