// Viewport tracking. Layout mode is chosen continuously from the actual
// aspect ratio (not device type) and re-evaluated on resize/orientation
// change without reloading.

import { useEffect, useState } from 'react';
import { ASPECT, type LayoutMode } from '../config/layout';

export interface Viewport {
  w: number;
  h: number;
  mode: LayoutMode;
}

export function computeViewport(): Viewport {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  const a = w / h;
  let mode: LayoutMode = 'nearsquare';
  if (a <= ASPECT.portraitMax) mode = 'portrait';
  else if (a >= ASPECT.wideMin) mode = 'wide';
  return { w, h, mode };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => computeViewport());
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(computeViewport()));
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}
