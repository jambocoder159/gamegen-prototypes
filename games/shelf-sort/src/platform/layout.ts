// Layout chosen from the live viewport aspect ratio (not device type). Re-runs
// on resize/orientation without reload. Uses visualViewport when available.

import { useEffect, useState } from 'react';

export type Layout = 'portrait' | 'nearSquare' | 'wide';

export interface Viewport {
  w: number;
  h: number;
  layout: Layout;
}

function read(): Viewport {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const aspect = w / h; // width / height
  // Tall phones are "portrait"; the foldable/tablet band around square (and mild
  // landscape) is "near-square"; clearly wide screens are "wide". Thresholds are
  // tuned so the spec's resize matrix maps as intended (e.g. 626×890 → near-sq).
  let layout: Layout;
  if (aspect < 0.66) layout = 'portrait';
  else if (aspect <= 1.5) layout = 'nearSquare';
  else layout = 'wide';
  return { w, h, layout };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() =>
    typeof window === 'undefined' ? { w: 390, h: 844, layout: 'portrait' } : read(),
  );
  useEffect(() => {
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    window.visualViewport?.addEventListener('resize', onChange);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.visualViewport?.removeEventListener('resize', onChange);
    };
  }, []);
  return vp;
}
