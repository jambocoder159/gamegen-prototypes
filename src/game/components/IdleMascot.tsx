// Idle mascot: seq_mochi_idle_1..4 looping at ~6 fps. Under reduced motion it
// holds the first frame (no continuous movement).
import { useEffect, useState } from 'react';
import { Art } from './Art';
import type { ImageKey } from '../../config/assets';

const FRAMES: ImageKey[] = ['idle1', 'idle2', 'idle3', 'idle4'];

export function IdleMascot({ reduced, className }: { reduced: boolean; className?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 1000 / 6);
    return () => window.clearInterval(id);
  }, [reduced]);
  const key = reduced ? FRAMES[0] : FRAMES[frame];
  return <Art imgKey={key} alt="" className={className ? `mascot ${className}` : 'mascot'} />;
}
