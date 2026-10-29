// The playing screen: dew/rate pills, stage progress bar (flag + boss chip), plant
// codex, the big tappable pot, the 4×4 garden (with locked plots), and the control
// buttons (buy seed, upgrades, relics, rebirth, sound, language, reset). Owns
// keyboard input — arrows move focus across the plots, Enter/Space act, T taps the
// pot, B buys a seed, G/R/E open the dialogs — and hosts the offline / celebration
// / reset overlays, the accessible Upgrades / Relics / Rebirth dialogs, and the
// stage-clear toast.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { formatNumber } from './format';
import { hasEmptyPlot } from './logic';
import { PLOT_COUNT, isPlotUnlocked } from './config';
import { useGarden } from './useGarden';
import { Stats } from './components/Stats';
import { StageBar } from './components/StageBar';
import { Collection } from './components/Collection';
import { Pot } from './components/Pot';
import { PlotGrid } from './components/PlotGrid';
import { Button } from './components/Button';
import { Art } from './components/Art';
import { SoundControl, LanguageControl } from './components/Controls';
import { OfflineDialog, CelebrationOverlay, ResetConfirm } from './components/Overlays';
import { UpgradesDialog } from './components/UpgradesDialog';
import { RelicsDialog } from './components/RelicsDialog';
import { RebirthDialog } from './components/RebirthDialog';
import { Help, Announcer, DewLive } from './components/A11y';

const COLS = 4;
const POP_MS = 650;
const TOAST_MS = 2600;

type Modal = 'none' | 'upgrades' | 'relics' | 'rebirth';

export function GardenScreen({ layout, reduced }: { layout: Layout; reduced: boolean }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const g = useGarden(manager);
  const rootRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLButtonElement>(null);
  const [resetting, setResetting] = useState(false);
  const [modal, setModal] = useState<Modal>('none');
  const [pop, setPop] = useState<number | null>(null);
  const [toast, setToast] = useState<typeof g.stageToast>(null);

  // merge pop / dew-droplet cue on the resulting plot
  useEffect(() => {
    const e = g.event;
    if (e && (e.kind === 'merged' || e.kind === 'newMax') && e.plot != null) {
      setPop(e.plot);
      const id = window.setTimeout(() => setPop(null), POP_MS);
      return () => window.clearTimeout(id);
    }
  }, [g.event]);

  // stage-clear toast (auto-dismiss)
  useEffect(() => {
    if (!g.stageToast) return;
    setToast(g.stageToast);
    const id = window.setTimeout(() => {
      setToast(null);
      g.dismissStageToast();
    }, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [g.stageToast, g.dismissStageToast]);

  const overlayOpen =
    g.offline != null || g.celebrate || resetting || modal !== 'none';

  const moveFocus = useCallback(
    (delta: number) => {
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement as HTMLElement | null;
      const cur = active?.dataset?.plot != null ? Number(active.dataset.plot) : -1;
      let next = cur < 0 ? 0 : cur + delta;
      while (next >= 0 && next < PLOT_COUNT && !isPlotUnlocked(next, g.snap.unlocked)) next += delta;
      if (next < 0 || next >= PLOT_COUNT) return;
      root.querySelector<HTMLButtonElement>(`[data-plot="${next}"]`)?.focus();
    },
    [g.snap.unlocked],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (overlayOpen) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-COLS);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(COLS);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          potRef.current?.click();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          g.buy();
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setModal('upgrades');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setModal('relics');
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          setModal('rebirth');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveFocus, overlayOpen, g]);

  const canBuy = hasEmptyPlot(g.snap) && g.snap.dew >= g.d.seedCost;

  return (
    <div className={`garden garden--${layout}`} ref={rootRef}>
      <div className="garden__surface" inert={overlayOpen}>
      <div className="garden__stats">
        <Stats dew={g.snap.dew} rate={g.d.passivePerSec} />
      </div>

      <div className="garden__dex">
        <Collection maxLevel={g.snap.discovered} />
      </div>

      <div className="garden__stage">
        <StageBar
          stage={g.snap.stage}
          earned={g.snap.earned}
          goal={g.d.goal}
          isBoss={g.d.isBoss}
          bossReq={g.d.bossReq}
          bossMet={g.d.bossMet}
        />
      </div>

      <div className="garden__pot">
        <Pot
          onTap={g.tapPot}
          bloom={g.bloom}
          reduced={reduced}
          label={t('buttons.tapPot')}
          buttonRef={potRef}
        />
      </div>

      <div className="garden__board">
        <PlotGrid
          plots={g.snap.plots}
          unlocked={g.snap.unlocked}
          selected={g.selected}
          interactive={!overlayOpen}
          reduced={reduced}
          popPlot={pop}
          onTap={g.tapPlot}
          ariaLabel={t('a11y.boardLabel')}
        />
      </div>

      <div className="garden__controls">
        <div className="garden__actions">
          <Button className="btn btn--cost btn--buy" onClick={g.buy} dimmed={!canBuy}>
            <Art imgKey="iconSeedbag" alt="" className="btn__icon" />
            <span className="btn__label">{t('buttons.buySeed')}</span>
            <span className="btn__cost">
              <Art imgKey="iconDew" alt="" className="btn__dew" />
              {formatNumber(g.d.seedCost)}
            </span>
          </Button>

          <Button className="btn btn--menu btn--upgrades" onClick={() => setModal('upgrades')}>
            <Art imgKey="iconUpgrade" alt="" className="btn__icon" />
            <span className="btn__label">{t('buttons.upgrades')}</span>
          </Button>

          <Button className="btn btn--menu btn--relics" onClick={() => setModal('relics')}>
            <Art imgKey="iconChest" alt="" className="btn__icon" />
            <span className="btn__label">{t('buttons.relics')}</span>
          </Button>

          <Button
            className={`btn btn--menu btn--rebirth${g.d.rebirthAvailable ? ' btn--ready' : ''}`}
            onClick={() => setModal('rebirth')}
          >
            <Art imgKey={g.d.rebirthAvailable ? "iconRebirth" : "iconLock"} alt="" className="btn__icon" />
            <span className="btn__label">{t('buttons.rebirth')}</span>
          </Button>
        </div>

        <div className="garden__icons">
          <SoundControl />
          <LanguageControl />
          <Button className="btn btn--reset" onClick={() => setResetting(true)}>
            {t('buttons.reset')}
          </Button>
        </div>
      </div>

      <Help />
      <Announcer event={g.event} />
      <DewLive dew={g.liveDew} />

      {toast && (
        <div className="toast" role="status">
          <Art imgKey="iconChest" alt="" className="toast__icon" />
          <span className="toast__text">
            {t('stage.cleared', { n: toast.stage - 1 })}
            {toast.chest >= 1 && (
              <span className="toast__chest">
                {' '}
                +{formatNumber(toast.chest)}
                <Art imgKey="iconDew" alt="" className="toast__dew" />
              </span>
            )}
          </span>
        </div>
      )}

      </div>

      {modal === 'upgrades' && <UpgradesDialog g={g} onClose={() => setModal('none')} />}
      {modal === 'relics' && <RelicsDialog g={g} onClose={() => setModal('none')} />}
      {modal === 'rebirth' && <RebirthDialog g={g} onClose={() => setModal('none')} />}

      {g.offline != null && <OfflineDialog amount={g.offline} onCollect={g.dismissOffline} />}
      {g.celebrate && <CelebrationOverlay reduced={reduced} onClose={g.dismissCelebrate} />}
      {resetting && (
        <ResetConfirm
          onConfirm={() => {
            g.reset();
            setResetting(false);
          }}
          onCancel={() => setResetting(false)}
        />
      )}
    </div>
  );
}
