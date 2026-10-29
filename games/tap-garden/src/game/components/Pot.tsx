// The magic pot: a big real <button> built from the seq_pot_tap frames. Idle is
// frame 1; a tap squashes (2) then pops (3) back to idle; a merge / level-up
// blooms (4) for a moment. Floating "+n" dew numbers rise near the pot as real
// text; a crit shows a bigger highlighted number plus a brief icon_crit burst.
// Under reduced motion the frame still changes on tap (a visible state change) but
// nothing drifts continuously and the "+n" text / burst do not travel.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { potFrameKey } from '../../config/assets';
import { formatNumber } from '../format';
import { Art } from './Art';
import { useAudio } from '../../platform/AudioContext';

interface Float {
  id: number;
  text: string;
  crit: boolean;
}

export interface TapOutcome {
  gained: number;
  crit: boolean;
}

export function Pot({
  onTap,
  bloom,
  reduced,
  label,
  buttonRef,
}: {
  onTap: () => TapOutcome;
  bloom: number;
  reduced: boolean;
  label: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { manager } = useAudio();
  const [frame, setFrame] = useState(1);
  const [floats, setFloats] = useState<Float[]>([]);
  const [burst, setBurst] = useState(0);
  const timers = useRef<Set<number>>(new Set());
  const frameTimers = useRef<number[]>([]);
  const floatId = useRef(0);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current.clear();
  };
  useEffect(() => clearTimers, []);

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  };

  const handleTap = useCallback(() => {
    const { gained, crit } = onTap();
    frameTimers.current.forEach(id => window.clearTimeout(id));
    frameTimers.current.forEach(id => timers.current.delete(id));
    manager.playSfx('sfxClick');
    setFrame(2);
    frameTimers.current = [schedule(() => setFrame(3), 80), schedule(() => setFrame(1), 180)];
    const id = ++floatId.current;
    setFloats((f) => [...f.slice(-5), { id, text: `+${formatNumber(gained)}`, crit }]);
    schedule(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
    if (crit) {
      setBurst((b) => b + 1);
      schedule(() => setBurst(0), 500);
    }
  }, [onTap, manager]);

  const lastBloom = useRef(bloom);
  useEffect(() => {
    if (bloom === lastBloom.current) return;
    lastBloom.current = bloom;
    frameTimers.current.forEach(id => window.clearTimeout(id));
    frameTimers.current.forEach(id => timers.current.delete(id));
    setFrame(4);
    frameTimers.current = [schedule(() => setFrame(1), 520)];
  }, [bloom]);

  return (
    <button type="button" ref={buttonRef} className="pot" aria-label={label} onPointerEnter={() => manager.playSfx('sfxHover')} onClick={handleTap}>
      <Art imgKey={potFrameKey(frame)} alt="" className="pot__img" />
      {burst > 0 && (
        <span className={`pot__burst${reduced ? ' pot__burst--still' : ''}`} aria-hidden>
          <Art imgKey="iconCrit" alt="" className="pot__burst-img" />
        </span>
      )}
      <span className="pot__floats" aria-hidden>
        {floats.map((f) => (
          <span
            key={f.id}
            className={`pot__float${f.crit ? ' pot__float--crit' : ''}${
              reduced ? ' pot__float--still' : ''
            }`}
          >
            {f.text}
          </span>
        ))}
      </span>
    </button>
  );
}
