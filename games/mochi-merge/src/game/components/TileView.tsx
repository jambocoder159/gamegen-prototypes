// One mochi tile. Outer element owns the slide (transform translate, animated by
// CSS transition); inner element owns the spawn/merge pop (CSS animation) so the
// two never fight over the transform property. Keyed by stable id for DOM reuse.
import { memo } from 'react';
import { cellPct } from '../../config/layout';
import { tileImageKey, type ImageKey } from '../../config/assets';
import { Art } from './Art';
import type { Tile } from '../logic';

function TileViewImpl({ tile }: { tile: Tile }) {
  const c = cellPct(tile.row, tile.col);
  // translate in % of the tile's OWN box (same size for every tile)
  const tx = (c.left / c.w) * 100;
  const ty = (c.top / c.h) * 100;
  const innerCls =
    'tile__inner' + (tile.merged ? ' pop-merge' : '') + (tile.isNew ? ' pop-spawn' : '');
  return (
    <div
      className="tile"
      aria-hidden
      style={{
        width: `${c.w}%`,
        height: `${c.h}%`,
        transform: `translate(${tx}%, ${ty}%)`,
      }}
    >
      <div className={innerCls}>
        <Art imgKey={tileImageKey(tile.tier) as ImageKey} alt="" className="tile__img" />
      </div>
    </div>
  );
}

export const TileView = memo(TileViewImpl);
