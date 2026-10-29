// The magic pot: a big real <button> built from the seq_pot_tap frames. Idle is
// frame 1; a tap squashes (2) then pops (3) back to idle; a merge / level-up
// blooms (4) for a moment. Floating "+n" dew numbers rise near the pot as real
// text (aria-hidden — the dew total is announced by the live region elsewhere).
// Under reduced motion the frame still changes on tap (a visible state change)
// but nothing drifts continuously and the "+n" text does not travel.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { potFrameKey } from '../../config/assets';
import { Art } from './Art';

interface Float {
  id: number;
  text: string;
}

export function Pot({
  onTap,
  bloom,
  reduced,
  label,
  buttonRef,
}: {
  onTap: () => number; // performs the tap, returns dew gained
  bloom: number; // increment → play the bloom frame
  reduced: boolean;
  label: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [frame, setFrame] = useState(1);
  const [floats, setFloats] = useState<Float[]>([]);
  const timers = useRef<number[]>([]);
  const floatId = useRef(0);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const handleTap = useCallback(() => {
    const gained = onTap();
    clearTimers();
    setFrame(2);
    schedule(() => setFrame(3), 80);
    schedule(() => setFrame(1), 180);
    const id = ++floatId.current;
    setFloats((f) => [...f.slice(-5), { id, text: `+${gained}` }]);
    schedule(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
  }, [onTap]);

  // bloom frame on merges / level-ups
  const lastBloom = useRef(bloom);
  useEffect(() => {
    if (bloom === lastBloom.current) return;
    lastBloom.current = bloom;
    clearTimers();
    setFrame(4);
    schedule(() => setFrame(1), 520);
  }, [bloom]);

  return (
    <button
      type="button"
      ref={buttonRef}
      className="pot"
      aria-label={label}
      onClick={handleTap}
    >
      <Art imgKey={potFrameKey(frame)} alt="" className="pot__img" />
      <span className="pot__floats" aria-hidden>
        {floats.map((f) => (
          <span key={f.id} className={`pot__float${reduced ? ' pot__float--still' : ''}`}>
            {f.text}
          </span>
        ))}
      </span>
    </button>
  );
}
