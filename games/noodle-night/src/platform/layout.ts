// Viewport-driven layout + reduced-motion, chosen continuously from the aspect ratio.

import { useEffect, useState } from 'react';

export type LayoutMode = 'portrait' | 'square' | 'wide';

export interface Viewport {
  mode: LayoutMode;
  w: number;
  h: number;
}

function read(): Viewport {
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  let mode: LayoutMode;
  if (h / w >= 1.15) mode = 'portrait';
  else if (w / h >= 1.6) mode = 'wide';
  else mode = 'square';
  return { mode, w, h };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => read());
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, []);
  return vp;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
