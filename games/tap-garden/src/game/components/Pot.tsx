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
  autoRate, autoValue, floating,
  bloom,
  reduced,
  label,
  buttonRef,
}: {
  onTap: () => TapOutcome;
  autoRate: number; autoValue: number; floating: boolean;
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

  const showTap = useCallback(({ gained, crit }: TapOutcome) => {
    frameTimers.current.forEach(id => window.clearTimeout(id));
    frameTimers.current.forEach(id => timers.current.delete(id));
    setFrame(2);
    frameTimers.current = [schedule(() => setFrame(3), 80), schedule(() => setFrame(1), 180)];
    const id = ++floatId.current;
    if (floating) setFloats((f) => [...f.slice(-3), { id, text: `+${formatNumber(gained)}`, crit }]);
    schedule(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
    if (crit) {
      setBurst((b) => b + 1);
      schedule(() => setBurst(0), 500);
    }
  }, [floating]);
  const handleTap = () => { manager.playSfx('sfxClick'); showTap(onTap()); };
  useEffect(() => {
    if (autoRate <= 0) return;
    // At most two visual taps/sec, aggregating the income between cues.
    const ms = Math.max(500, 1000 / autoRate);
    const id = window.setInterval(() => showTap({ gained: autoValue * autoRate * ms / 1000, crit: false }), ms);
    return () => window.clearInterval(id);
  }, [autoRate, autoValue, showTap]);
  useEffect(() => { if (!floating) setFloats([]); }, [floating]);

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
    <button type="button" ref={buttonRef} className={`pot${burst > 0 ? ' pot--crit' : ''}`} aria-label={label} onPointerEnter={() => manager.playSfx('sfxHover')} onClick={handleTap}>
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
            style={{ left: `${35 + f.id % 3 * 15}%`, top: `${10 + f.id % 2 * 18}%` }}
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
