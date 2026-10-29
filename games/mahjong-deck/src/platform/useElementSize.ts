// Observe an element's content-box size live (ResizeObserver). Returns a ref to
// attach and the current {w, h} in CSS px. Re-measures on any layout change, so
// the board re-fits on resize/orientation without a reload.
import { useEffect, useRef, useState } from 'react';

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}
