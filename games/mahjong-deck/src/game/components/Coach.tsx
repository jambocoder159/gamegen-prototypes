import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Art } from './Art';
import { CatalogLink } from './CatalogLink';
const KEY = 'mahjong-deck.coach';
function firstVisit() { try { return localStorage.getItem(KEY) !== '1'; } catch { return true; } }
export function useCoach(selected: number | null, score: number, handCount: number) {
  const [step, setStep] = useState(() => firstVisit() ? 0 : -1);
  const [baseline, setBaseline] = useState(handCount);
  const [helpOpen, setHelpOpen] = useState(false);
  const finish = () => { setHelpOpen(false); setStep(-1); try { localStorage.setItem(KEY, '1'); } catch { /* unavailable */ } };
  useEffect(() => { if (step === 0 && selected !== null) setStep(1); }, [step, selected]);
  useEffect(() => { if (step === 1 && score > 0) { setBaseline(handCount); setStep(2); } }, [step, score, handCount]);
  useEffect(() => { if (step === 2 && handCount < baseline) finish(); }, [step, handCount, baseline]);
  return { step, helpOpen, finish, reopen: () => { setHelpOpen(true); } };
}

export function HelpDialog({ onClose, onLeave }: { onClose: () => void; onLeave: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="help-dialog panel" aria-labelledby="help-title"
    onKeyDown={(e) => {
      if (e.key !== 'Tab') return;
      const controls = ref.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }}
    onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <div className="coach coach--help">
      <h2 id="help-title" className="panel__title">{t('coach.help')}</h2>
      <p>{t('a11y.help')}</p>
      <Button className="btn coach__skip" onClick={onClose}>{t('buttons.close')}</Button>
      <CatalogLink onLeave={onLeave} />
    </div>
  </dialog>;
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
