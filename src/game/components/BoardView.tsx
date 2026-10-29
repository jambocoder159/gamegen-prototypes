// The tile stack. Every tile is a real <button> absolutely positioned at its
// half-cell coordinate, with a per-layer up-left offset so the stack reads as 3D
// (higher z drawn above). The whole board is laid out at an intrinsic pixel size
// and scaled with a CSS transform to fit the available space, staying centred.
// Covered tiles are dimmed and non-interactive; free tiles are clickable and
// keyboard-focusable. Shared by the play screen and the title demo.

import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { useElementSize } from '../../platform/useElementSize';
import { TILE_KEYS, tileImageKey } from '../../config/assets';
import { isFree, type Tile } from '../logic';
import { Art } from './Art';

const BT = 72; // base tile width (px, pre-scale); actual size comes from the transform
const TILE_ASPECT = 182 / 199; // sprite w/h
const HT = BT / TILE_ASPECT; // base tile height
const OFF_X = -0.1 * BT; // per-layer x offset (up-left stack)
const OFF_Y = -0.12 * HT; // per-layer y offset

interface Placed {
  tile: Tile;
  left: number;
  top: number;
  z: number;
}

export function BoardView({
  tiles,
  selected,
  hint,
  interactive,
  onTap,
  ariaLabel,
  shakeId,
  reduced,
}: {
  tiles: Tile[];
  selected: number | null;
  hint: [number, number] | null;
  interactive: boolean;
  onTap?: (id: number) => void;
  ariaLabel?: string;
  shakeId?: number;
  reduced?: boolean;
}) {
  const { t } = useI18n();
  const { ref, size } = useElementSize<HTMLDivElement>();

  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!shakeId || reduced) return;
    setShaking(true);
    const id = window.setTimeout(() => setShaking(false), 360);
    return () => window.clearTimeout(id);
  }, [shakeId, reduced]);

  // Place every tile (removed ones kept for the scale-out animation).
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  const placed: Placed[] = tiles.map((tile) => {
    const left = tile.x * (BT / 2) + tile.z * OFF_X;
    const top = tile.y * (HT / 2) + tile.z * OFF_Y;
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, left + BT);
    maxBottom = Math.max(maxBottom, top + HT);
    return { tile, left, top, z: tile.z };
  });
  const intrinsicW = maxRight - minLeft || BT;
  const intrinsicH = maxBottom - minTop || HT;
  const scale =
    size.w > 0 && size.h > 0 ? Math.min(size.w / intrinsicW, size.h / intrinsicH) : 0;
  // keep track of the smallest rendered tile width (used by the logic test output)
  const tilePx = scale * BT;

  const hintSet = hint ? new Set(hint) : null;

  return (
    <div
      className={`board${shaking ? ' board--shake' : ''}`}
      ref={ref}
      role="group"
      aria-label={ariaLabel}
    >
      {scale > 0 && (
        <div
          className="board__stack"
          style={{
            width: `${intrinsicW}px`,
            height: `${intrinsicH}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
          data-tile-px={Math.round(tilePx)}
        >
          {placed.map(({ tile, left, top, z }) => {
            if (tile.removed) {
              return (
                <span
                  key={tile.id}
                  className="tile tile--gone"
                  aria-hidden="true"
                  style={{
                    left: `${left - minLeft}px`,
                    top: `${top - minTop}px`,
                    width: `${BT}px`,
                    height: `${HT}px`,
                    zIndex: z * 100 + tile.y + tile.x,
                  }}
                >
                  <Art imgKey={tileImageKey(tile.type)} alt="" className="tile__img" />
                </span>
              );
            }
            const free = isFree(tile, tiles);
            const isSelected = selected === tile.id;
            const isHint = hintSet?.has(tile.id) ?? false;
            const name = t(`tiles.${TILE_KEYS[tile.type]}`);
            const stateText = free ? t('a11y.tileFree') : t('a11y.tileCovered');
            const label = isSelected
              ? t('a11y.tileSelected', { name, state: stateText })
              : t('a11y.tile', { name, state: stateText });
            const cls =
              'tile' +
              (free ? ' tile--free' : ' tile--covered') +
              (isSelected ? ' tile--selected' : '') +
              (isHint ? (reduced ? ' tile--hint-static' : ' tile--hint') : '');
            return (
              <button
                key={tile.id}
                type="button"
                className={cls}
                data-tid={tile.id}
                data-type={TILE_KEYS[tile.type]}
                data-free={free ? '1' : '0'}
                data-x={tile.x}
                data-y={tile.y}
                data-z={tile.z}
                aria-label={label}
                aria-pressed={isSelected}
                aria-disabled={!free || !interactive}
                tabIndex={free && interactive ? 0 : -1}
                style={{
                  left: `${left - minLeft}px`,
                  top: `${top - minTop}px`,
                  width: `${BT}px`,
                  height: `${HT}px`,
                  zIndex: z * 100 + tile.y + tile.x + (isSelected ? 10000 : 0),
                }}
                onClick={() => {
                  if (free && interactive) onTap?.(tile.id);
                }}
              >
                <span className="tile__face">
                  <Art imgKey={tileImageKey(tile.type)} alt="" className="tile__img" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { BT, TILE_ASPECT };
