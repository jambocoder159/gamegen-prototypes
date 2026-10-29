// The playing screen: dew/rate pills, the plant collection, the big tappable pot,
// the 4×4 garden, and the controls (buy seed, upgrade tap, sound, language,
// reset). Owns keyboard input — arrows move focus across the 16 plots, Enter/
// Space act (native on the plot buttons), T taps the pot, B buys a seed, U
// upgrades — and hosts the offline / celebration / reset overlays.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useAudio } from '../platform/AudioContext';
import type { Layout } from '../platform/layout';
import { formatDew } from './format';
import { useGarden } from './useGarden';
import { Stats } from './components/Stats';
import { Collection } from './components/Collection';
import { Pot } from './components/Pot';
import { PlotGrid } from './components/PlotGrid';
import { Button } from './components/Button';
import { Art } from './components/Art';
import { SoundControl, LanguageControl } from './components/Controls';
import { OfflineDialog, CelebrationOverlay, ResetConfirm } from './components/Overlays';
import { Help, Announcer, DewLive } from './components/A11y';

const COLS = 4;
const POP_MS = 650;

export function GardenScreen({ layout, reduced }: { layout: Layout; reduced: boolean }) {
  const { t, lang } = useI18n();
  const { manager } = useAudio();
  const g = useGarden(manager);
  const rootRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLButtonElement>(null);
  const [resetting, setResetting] = useState(false);
  const [pop, setPop] = useState<number | null>(null);

  // merge pop / dew-droplet cue on the resulting plot
  useEffect(() => {
    const e = g.event;
    if (e && (e.kind === 'merged' || e.kind === 'newMax') && e.plot != null) {
      setPop(e.plot);
      const id = window.setTimeout(() => setPop(null), POP_MS);
      return () => window.clearTimeout(id);
    }
  }, [g.event]);

  const overlayOpen = g.offline != null || g.celebrate || resetting;

  const moveFocus = useCallback((delta: number) => {
    const root = rootRef.current;
    if (!root) return;
    const active = document.activeElement as HTMLElement | null;
    const cur = active?.dataset?.plot != null ? Number(active.dataset.plot) : -1;
    const next = Math.max(0, Math.min(15, cur < 0 ? 0 : cur + delta));
    root.querySelector<HTMLButtonElement>(`[data-plot="${next}"]`)?.focus();
  }, []);

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
        case 'u':
        case 'U':
          e.preventDefault();
          g.upgrade();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveFocus, overlayOpen, g]);

  const buyLabel = t('buttons.buySeedAria', { cost: formatDew(g.seedCost, lang) });
  const upLabel = t('buttons.upgradeAria', { cost: formatDew(g.upgradeCost, lang) });

  return (
    <div className={`garden garden--${layout}`} ref={rootRef}>
      <div className="garden__stats">
        <Stats dew={g.snap.dew} rate={g.rate} />
      </div>

      <div className="garden__dex">
        <Collection maxLevel={g.snap.maxLevel} />
      </div>

      <div className="garden__pot">
        <Pot onTap={g.tapPot} bloom={g.bloom} reduced={reduced} label={t('buttons.tapPot')} buttonRef={potRef} />
      </div>

      <div className="garden__board">
        <PlotGrid
          plots={g.snap.plots}
          selected={g.selected}
          interactive={!overlayOpen}
          reduced={reduced}
          popPlot={pop}
          onTap={g.tapPlot}
          ariaLabel={t('a11y.boardLabel')}
        />
      </div>

      <div className="garden__controls">
        <Button className="btn btn--cost btn--buy" onClick={g.buy} dimmed={!g.canBuy} ariaLabel={buyLabel}>
          <Art imgKey="iconSeedbag" alt="" className="btn__icon" />
          <span className="btn__label">{t('buttons.buySeed')}</span>
          <span className="btn__cost">
            <Art imgKey="iconDew" alt="" className="btn__dew" />
            {formatDew(g.seedCost, lang)}
          </span>
        </Button>

        <Button
          className="btn btn--cost btn--upgrade"
          onClick={g.upgrade}
          dimmed={!g.canUpgrade}
          ariaLabel={upLabel}
        >
          <Art imgKey="iconUpgrade" alt="" className="btn__icon" />
          <span className="btn__label">{t('buttons.upgrade')}</span>
          <span className="btn__cost">
            <Art imgKey="iconDew" alt="" className="btn__dew" />
            {formatDew(g.upgradeCost, lang)}
          </span>
        </Button>

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
