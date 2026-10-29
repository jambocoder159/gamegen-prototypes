// The tile stack. Every tile is a real <button> absolutely positioned by the
// shared geometry module (so the rules match the picture exactly); z-index and a
// drop-shadow give the stack its depth. The whole board is laid out at an
// intrinsic pixel size and scaled with a CSS transform to fit the available
// space, staying centred. Blocked tiles are dimmed; free tiles are bright,
// clickable and keyboard-focusable. Tapping a blocked tile reports why (via
// onTap) but costs nothing. Shared by the play screen and the title demo.

import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { useElementSize } from '../../platform/useElementSize';
import { TILE_KEYS, tileImageKey } from '../../config/assets';
import { isFree, blockReason, type Tile } from '../logic';
import { BT, HT, tileBox } from '../geometry';
import { Art } from './Art';

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
  blockedTapId,
  blockedTapSeq,
  reduced,
}: {
  tiles: Tile[];
  selected: number | null;
  hint: [number, number] | null;
  interactive: boolean;
  onTap?: (id: number) => void;
  ariaLabel?: string;
  shakeId?: number;
  blockedTapId?: number | null;
  blockedTapSeq?: number;
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

  // A single blocked tile jiggles when it's tapped while covered/side-blocked.
  const [shakeTile, setShakeTile] = useState<number | null>(null);
  useEffect(() => {
    if (!blockedTapSeq || blockedTapId == null || reduced) return;
    setShakeTile(blockedTapId);
    const id = window.setTimeout(() => setShakeTile(null), 360);
    return () => window.clearTimeout(id);
  }, [blockedTapSeq, blockedTapId, reduced]);

  // Place every tile (removed ones kept for the scale-out animation).
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  const placed: Placed[] = tiles.map((tile) => {
    const { left, top } = tileBox(tile);
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
            const reason = free ? null : blockReason(tile, tiles);
            const isSelected = selected === tile.id;
            const isHint = hintSet?.has(tile.id) ?? false;
            const name = t(`tiles.${TILE_KEYS[tile.type]}`);
            const stateText = free
              ? t('a11y.tileFree')
              : reason === 'side'
                ? t('a11y.tileBlocked')
                : t('a11y.tileCovered');
            const label = isSelected
              ? t('a11y.tileSelected', { name, state: stateText })
              : t('a11y.tile', { name, state: stateText });
            const cls =
              'tile' +
              (free ? ' tile--free' : ' tile--covered') +
              (isSelected ? ' tile--selected' : '') +
              (shakeTile === tile.id ? ' tile--shake' : '') +
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
                  // Free → play it. Blocked → still report the tap so the game can
                  // explain why (and jiggle), but it never costs anything.
                  if (interactive) onTap?.(tile.id);
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
