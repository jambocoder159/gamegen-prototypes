import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { AUTO_MERGE_STAGE, R } from '../config';
import { relicFx } from '../relics';
import type { GameState } from '../logic';
import type { UseGarden } from '../useGarden';
import { formatNumber, formatRate } from '../format';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Art } from './Art';

export function OfflineRatio({ state }: { state: GameState }) {
  const { t } = useI18n();
  const moon = state.relics[R.moon];
  return <p className="offline-ratio">{t('extra.offlineRatio', { pct: Math.round(100 * relicFx.offlineRate(moon)), hours: +(relicFx.offlineCapSec(moon) / 3600).toFixed(2) })}</p>;
}
export function StatisticsDialog({ g, onClose }: { g: UseGarden; onClose: () => void }) {
  const { t } = useI18n();
  const s = g.snap; const c = s.stats; const r = s.runStats;
  const total = r.click + r.auto + r.passive;
  const share = (value: number) => total ? `${(100 * value / total).toFixed(1)}%` : '0%';
  const rows: [string, string | number][] = [
    ['taps', formatNumber(c.taps)], ['crits', formatNumber(c.crits)],
    ['dew', formatNumber(c.dew)], ['runDew', formatNumber(r.dew)], ['merges', formatNumber(c.merges)],
    ['tier', s.discovered], ['stages', c.stages], ['rebirths', s.rebirths],
    ['relics', s.relics.filter(n => n > 0).length], ['time', t('extra.minutes', { n: (c.seconds / 60).toFixed(1) })],
    ['best', s.maxStageEver], ['rate', formatRate(g.d.passivePerSec + g.d.autoPerSec)],
    ['click', share(r.click)], ['auto', share(r.auto)], ['passive', share(r.passive)],
    ['bonus', formatNumber(r.bonus)], ['offline', formatNumber(c.offline)],
  ];
  return <Dialog title={t('extra.stats')} className="dialog--stats" onClose={onClose}>
    <p>{t('extra.shareNote')}</p>
    <dl className="statistics">{rows.map(([key, value]) => <div key={key}><dt>{t(`statistics.${key}`)}</dt><dd data-stat={key}>{value}</dd></div>)}</dl>
  </Dialog>;
}
export function SettingsDialog({ g, floating, setFloating, onClose }: { g: UseGarden; floating: boolean; setFloating: (v: boolean) => void; onClose: () => void }) {
  const { t } = useI18n();
  return <Dialog title={t('extra.settings')} className="dialog--settings" onClose={onClose}>
    <label className="setting"><span>{t('extra.floating')}</span><input className="floating-switch" type="checkbox" role="switch" checked={floating} onChange={e => setFloating(e.target.checked)} /></label>
    <label className="setting"><span>{t('extra.autoMerge')}</span><input className="auto-merge-switch" type="checkbox" role="switch" checked={g.snap.autoMerge} disabled={g.snap.stage < AUTO_MERGE_STAGE} onChange={g.toggleAutoMerge} /></label>
    <p>{t('extra.autoMergeHelp', { n: AUTO_MERGE_STAGE })}</p>
    <Button className="btn btn--merge-all" onClick={g.mergeAll}>{t('extra.mergeAll')}</Button>
    <OfflineRatio state={g.snap} />
  </Dialog>;
}
export function Coach({ g, step, setStep, dismiss }: { g: UseGarden; step: number; setStep: (v: number) => void; dismiss: () => void }) {
  const { t } = useI18n();
  const [baseline] = useState(() => ({ taps: g.snap.runStats.taps, seeds: g.snap.seedsBought, merges: g.snap.runStats.merges }));
  useEffect(() => {
    if (step === 0 && g.snap.runStats.taps >= baseline.taps + 10) setStep(1);
    if (step === 1 && g.snap.seedsBought >= baseline.seeds + 2) setStep(2);
    if (step === 2 && g.snap.runStats.merges > baseline.merges) dismiss();
  }, [step, g.snap.runStats.taps, g.snap.seedsBought, g.snap.runStats.merges, setStep, dismiss, baseline]);
  return <aside className="coach" aria-label={t('extra.help')}>
    <Art imgKey={step === 0 ? 'iconDew' : step === 1 ? 'iconSeedbag' : 'plant2'} alt="" className="coach__icon" />
    <p aria-live="polite">{t(`coach.step${step + 1}`)}</p>
    <Button className="btn coach__skip" onClick={dismiss}>{t('extra.skip')}</Button>
  </aside>;
}
export function useFloatingSetting() {
  const [floating, setValue] = useState(() => { try { return localStorage.getItem('tap-garden.floating') !== 'false'; } catch { return true; } });
  return [floating, (value: boolean) => { setValue(value); try { localStorage.setItem('tap-garden.floating', String(value)); } catch { /* optional storage */ } }] as const;
}
