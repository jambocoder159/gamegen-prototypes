// The shelf board: a responsive grid of shelves, each with three real <button>
// slots. Shared by the play screen (interactive) and the title demo (not). The
// board measures itself and picks a column count + shelf size that fit, keeping
// slots ≥ 44px where possible. Goods rest their bottom on the shelf board and are
// scaled to fit the slot keeping aspect.

import { useI18n } from '../../i18n';
import { useElementSize } from '../../platform/useElementSize';
import { goodsImageKey, GOODS_KEYS } from '../../config/assets';
import { SLOTS_PER_SHELF, type Board } from '../logic';
import { computeBoardLayout, SHELF, SHELF_ASPECT } from '../layout';
import type { ClearFx } from '../useGame';
import { Art } from './Art';

const SPARKLES = [
  { x: 14, y: 22 },
  { x: 50, y: 10 },
  { x: 84, y: 26 },
  { x: 30, y: 60 },
  { x: 70, y: 58 },
];

function Goods({ type, lifted }: { type: number; lifted?: boolean }) {
  return (
    <span className={`goods${lifted ? ' goods--lifted' : ''}`}>
      <Art imgKey={goodsImageKey(type)} alt="" className="goods__img" />
    </span>
  );
}

function SlotButton({
  shelf,
  pos,
  index,
  value,
  selected,
  interactive,
  onTap,
}: {
  shelf: number;
  pos: number;
  index: number;
  value: number | null;
  selected: boolean;
  interactive: boolean;
  onTap?: (i: number) => void;
}) {
  const { t } = useI18n();
  const usable = 1 - SHELF.padX * 2;
  const third = usable / SLOTS_PER_SHELF;
  const left = (SHELF.padX + pos * third) * 100;
  const width = third * 100;
  const content = value === null ? t('a11y.empty') : t(`goods.${GOODS_KEYS[value]}`);
  const labelKey = selected ? 'a11y.slotSelected' : 'a11y.slot';
  const label = t(labelKey, { shelf: shelf + 1, slot: pos + 1, content });
  return (
    <button
      type="button"
      className={`slot${selected ? ' slot--selected' : ''}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      data-slot={index}
      aria-label={label}
      aria-pressed={selected}
      disabled={!interactive}
      tabIndex={interactive ? 0 : -1}
      onClick={() => onTap?.(index)}
    >
      {value !== null && (
        <span className="slot__goods">
          <Goods type={value} lifted={selected} />
        </span>
      )}
    </button>
  );
}

function ShelfView({
  shelf,
  slots,
  selected,
  interactive,
  reduced,
  clearFx,
  onTap,
}: {
  shelf: number;
  slots: (number | null)[];
  selected: number | null;
  interactive: boolean;
  reduced: boolean;
  clearFx: ClearFx | null;
  onTap?: (i: number) => void;
}) {
  const base = shelf * SLOTS_PER_SHELF;
  const showFx = !reduced && clearFx !== null && clearFx.shelf === shelf;
  const usable = 1 - SHELF.padX * 2;
  const third = usable / SLOTS_PER_SHELF;
  return (
    <div className="shelf">
      <Art imgKey="shelf" alt="" className="shelf__bg" />
      {slots.map((v, pos) => (
        <SlotButton
          key={pos}
          shelf={shelf}
          pos={pos}
          index={base + pos}
          value={v}
          selected={selected === base + pos}
          interactive={interactive}
          onTap={onTap}
        />
      ))}
      {showFx && (
        <div className="shelf__fx" aria-hidden key={clearFx!.seq}>
          {[0, 1, 2].map((pos) => (
            <span
              className="slot__goods pop-out"
              key={pos}
              style={{ left: `${(SHELF.padX + pos * third) * 100}%`, width: `${third * 100}%` }}
            >
              <Goods type={clearFx!.type} />
            </span>
          ))}
          {SPARKLES.map((s, i) => (
            <Art
              key={i}
              imgKey="iconStar"
              alt=""
              className="sparkle"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BoardView({
  board,
  S,
  selected,
  interactive,
  reduced,
  clearFx,
  maxCols,
  onTap,
  ariaLabel,
}: {
  board: Board;
  S: number;
  selected: number | null;
  interactive: boolean;
  reduced: boolean;
  clearFx: ClearFx | null;
  maxCols: number;
  onTap?: (i: number) => void;
  ariaLabel?: string;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const layout =
    size.w > 0 && size.h > 0 ? computeBoardLayout(S, size.w, size.h, maxCols) : null;

  const shelves: (number | null)[][] = [];
  for (let s = 0; s < S; s++) {
    shelves.push(board.slice(s * SLOTS_PER_SHELF, s * SLOTS_PER_SHELF + SLOTS_PER_SHELF));
  }

  return (
    <div className="board" ref={ref} role="group" aria-label={ariaLabel}>
      {layout && (
        <div
          className="board__grid"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, ${layout.shelfW}px)`,
            gap: `${layout.gap}px`,
          }}
        >
          {shelves.map((slots, s) => (
            <div
              key={s}
              style={{ width: `${layout.shelfW}px`, aspectRatio: `${SHELF_ASPECT}` }}
            >
              <ShelfView
                shelf={s}
                slots={slots}
                selected={selected}
                interactive={interactive}
                reduced={reduced}
                clearFx={clearFx}
                onTap={onTap}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
