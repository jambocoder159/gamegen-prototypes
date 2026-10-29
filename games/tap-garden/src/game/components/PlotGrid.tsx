// The 4×4 garden: sixteen real <button> plots. Plots beyond `unlocked` show the
// lock icon and a price; the next expansion is purchasable here or in Upgrades. Shared by the play screen (interactive) and the title demo (read-only).
// The grid measures its container and sizes the square cells to fit, keeping cells
// ≥ 44px where the space allows. A selected plant lifts + outlines; a freshly
// merged plant pops and sprays icon_dew droplets (both skipped under reduced
// motion, but the new plant still appears).

import { useEffect, useRef, useState } from 'react';
import { formatRate, formatNumber } from '../format';
import { useI18n } from '../../i18n';
import { useElementSize } from '../../platform/useElementSize';
import { plantImageKey } from '../../config/assets';
import { PLOT_COUNT, PLOT_UNLOCK_ORDER, START_PLOTS, plotCost, incomeForLevel, isPlotUnlocked } from '../../game/config';
import { Art } from './Art';
import { useAudio } from '../../platform/AudioContext';

const COLS = 4;
const ROWS = 4;
const GAP = 6;
const MIN_CELL = 44;
const MAX_CELL = 128;
const DROPS = [
  { x: 20, y: 18 },
  { x: 78, y: 16 },
  { x: 50, y: 6 },
  { x: 30, y: 72 },
  { x: 72, y: 70 },
];

function cellSize(w: number, h: number): number {
  const cw = (w - (COLS - 1) * GAP) / COLS;
  const ch = (h - (ROWS - 1) * GAP) / ROWS;
  return Math.max(16, Math.min(cw, ch, MAX_CELL));
}

function Plot({
  index,
  level,
  locked,
  selected,
  interactive,
  popping,
  reduced,
  onTap, lockCost, affordable, nextLock,
}: {
  lockCost: number; affordable: boolean; nextLock: boolean;
  index: number;
  level: number;
  locked: boolean;
  selected: boolean;
  interactive: boolean;
  popping: boolean;
  reduced: boolean;
  onTap?: (i: number) => void;
}) {
  const { t } = useI18n();
  const { manager } = useAudio();
  const name = level > 0 ? t(`plant.${level}`) : '';
  const label = locked
    ? t('extra.buyPlot', { n: index + 1, cost: formatNumber(lockCost) })
    : level > 0
      ? selected
        ? t('a11y.plotSelected', { n: index + 1, name, level })
        : t('a11y.plot', { n: index + 1, name, level })
      : t('a11y.plotEmpty', { n: index + 1 });
  const showPop = popping && !reduced;
  return (
    <button
      type="button"
      className={`plot${selected ? ' plot--selected' : ''}${locked ? ' plot--locked' : ''}${locked && affordable && nextLock ? ' plot--affordable' : ''}`}
      data-plot={index}
      data-level={level}
      data-locked={locked ? 'true' : undefined}
      aria-label={label}
      aria-pressed={locked ? undefined : selected}
      disabled={!interactive}
      aria-disabled={locked && (!affordable || !nextLock) ? true : undefined}
      tabIndex={interactive ? 0 : -1}
      onPointerEnter={() => interactive && manager.playSfx('sfxHover')}
      onClick={() => { if (interactive) { manager.playSfx('sfxClick'); onTap?.(index); } }}
    >
      <Art imgKey="plot" alt="" className="plot__soil" />
      {locked && <><Art imgKey="iconLock" alt="" className="plot__lock" /><span className="plot__price">{formatNumber(lockCost)}</span></>}
      {!locked && level > 0 && (
        <span className={`plant${selected ? ' plant--lifted' : ''}${showPop ? ' plant--pop' : ''}`}>
          <Art imgKey={plantImageKey(level)} alt="" className="plant__img" />
        </span>
      )}
      {showPop && (
        <span className="plot__drops" aria-hidden>
          {DROPS.map((d, i) => (
            <Art
              key={i}
              imgKey="iconDew"
              alt=""
              className="drop"
              style={{ left: `${d.x}%`, top: `${d.y}%`, animationDelay: `${i * 30}ms` }}
            />
          ))}
        </span>
      )}
    </button>
  );
}

export function PlotGrid({
  plots,
  nextPlotCost = 0, dew = 0, floating = false, plantMult = 1,
  unlocked = PLOT_COUNT,
  selected,
  interactive,
  reduced,
  popPlot,
  onTap,
  ariaLabel,
}: {
  plots: number[];
  nextPlotCost?: number; dew?: number; floating?: boolean; plantMult?: number;
  unlocked?: number;
  selected: number | null;
  interactive: boolean;
  reduced: boolean;
  popPlot: number | null;
  onTap?: (i: number) => void;
  ariaLabel?: string;
}) {
  const [floats, setFloats] = useState<{ id: number; plot: number; amount: number; grouped: boolean; at: number }[]>([]);
  const live = useRef({ plots, unlocked, plantMult }); live.current = { plots, unlocked, plantMult };
  useEffect(() => {
    setFloats([]);
    if (!floating || !interactive) return;
    let cursor = 0; let id = 0; let last = performance.now();
    const pending = Array(PLOT_COUNT).fill(0);
    const lastCue = Array(PLOT_COUNT).fill(-Infinity);
    const interval = window.setInterval(() => {
      const now = performance.now(); const dt = Math.min(1, (now - last) / 1000); last = now;
      const { plots, unlocked, plantMult } = live.current;
      const active = plots.map((lv,i) => lv > 0 && isPlotUnlocked(i, unlocked) ? i : -1).filter(i => i >= 0);
      for (let i = 0; i < PLOT_COUNT; i++) pending[i] = active.includes(i) ? pending[i] + incomeForLevel(plots[i]) * plantMult * dt : 0;
      if (!active.length) { setFloats([]); return; }
      // Round robin guarantees every plant gets a turn. Dense gardens aggregate
      // four producers into each cue, still anchored at a producing flower.
      const next = active.findIndex((_,i) => now - lastCue[active[(cursor+i) % active.length]] >= 900);
      if (next < 0) { setFloats(f => f.filter(cue => now - cue.at < 900)); return; }
      cursor = (cursor + next) % active.length;
      const batch = active.length > 8 ? 4 : 1;
      const group = Array.from({ length: Math.min(batch, active.length) }, (_,i) => active[(cursor+i) % active.length]);
      cursor = (cursor + group.length) % active.length;
      const amount = group.reduce((sum,i) => sum + pending[i], 0);
      group.forEach(i => { pending[i] = 0; lastCue[i] = now; });
      const cue = { id: ++id, plot: group[0], amount, grouped: group.length > 1, at: now };
      setFloats(f => [...f.filter(cue => now - cue.at < 900).slice(-2), cue]);
    }, 300);
    return () => window.clearInterval(interval);
  }, [floating, interactive]);
  const { ref, size } = useElementSize<HTMLDivElement>();
  const cell = size.w > 0 && size.h > 0 ? cellSize(size.w, size.h) : 0;
  return (
    <div className="plots" ref={ref} role="group" aria-label={ariaLabel}>
      {cell > 0 && (
        <div
          className="plots__grid"
          style={{
            gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${cell}px)`,
            gap: `${GAP}px`,
          }}
          data-small={cell < MIN_CELL ? 'true' : undefined}
        >
          {Array.from({ length: PLOT_COUNT }, (_, i) => (
            <Plot
              key={i}
              index={i}
              nextLock={PLOT_UNLOCK_ORDER[unlocked] === i}
              lockCost={isPlotUnlocked(i, unlocked) ? 0 : nextPlotCost * plotCost(PLOT_UNLOCK_ORDER.indexOf(i) - START_PLOTS) / plotCost(unlocked - START_PLOTS)}
              affordable={dew >= nextPlotCost}
              level={plots[i] ?? 0}
              locked={!isPlotUnlocked(i, unlocked)}
              selected={selected === i}
              interactive={interactive}
              popping={popPlot === i}
              reduced={reduced}
              onTap={onTap}
            />
          ))}
          <div className="plant-floats" aria-hidden>{floats.map(f => <span key={f.id} className={`plant-float${reduced ? ' plant-float--still' : ''}`} style={{ left: `calc(50% - ${2 * cell + 1.5 * GAP}px + ${(f.plot % 4) * (cell + GAP) + cell / 2}px)`, top: `calc(50% - ${2 * cell + 1.5 * GAP}px + ${Math.floor(f.plot / 4) * (cell + GAP) + cell / 3}px)` }}>+{formatRate(f.amount)}{f.grouped ? ' Σ' : ''}</span>)}</div>
        </div>
      )}
    </div>
  );
}
