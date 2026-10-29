// The 4×4 garden: sixteen real <button> plots. Shared by the play screen
// (interactive) and the title demo (read-only). The grid measures its container
// and sizes the square cells to fit, keeping cells ≥ 44px where the space allows.
// A selected plant lifts + outlines; a freshly merged plant pops and sprays
// icon_dew droplets (both skipped under reduced motion, but the new plant still
// appears).

import { useI18n } from '../../i18n';
import { useElementSize } from '../../platform/useElementSize';
import { plantImageKey } from '../../config/assets';
import { PLOT_COUNT } from '../../config/config';
import { Art } from './Art';

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
  selected,
  interactive,
  popping,
  reduced,
  onTap,
}: {
  index: number;
  level: number;
  selected: boolean;
  interactive: boolean;
  popping: boolean;
  reduced: boolean;
  onTap?: (i: number) => void;
}) {
  const { t } = useI18n();
  const name = level > 0 ? t(`plant.${level}`) : '';
  const label =
    level > 0
      ? (selected
          ? t('a11y.plotSelected', { n: index + 1, name, level })
          : t('a11y.plot', { n: index + 1, name, level }))
      : t('a11y.plotEmpty', { n: index + 1 });
  const showPop = popping && !reduced;
  return (
    <button
      type="button"
      className={`plot${selected ? ' plot--selected' : ''}`}
      data-plot={index}
      data-level={level}
      aria-label={label}
      aria-pressed={selected}
      disabled={!interactive}
      tabIndex={interactive ? 0 : -1}
      onClick={() => onTap?.(index)}
    >
      <Art imgKey="plot" alt="" className="plot__soil" />
      {level > 0 && (
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
  selected,
  interactive,
  reduced,
  popPlot,
  onTap,
  ariaLabel,
}: {
  plots: number[];
  selected: number | null;
  interactive: boolean;
  reduced: boolean;
  popPlot: number | null;
  onTap?: (i: number) => void;
  ariaLabel?: string;
}) {
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
              level={plots[i] ?? 0}
              selected={selected === i}
              interactive={interactive}
              popping={popPlot === i}
              reduced={reduced}
              onTap={onTap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
