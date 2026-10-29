// The red-panda dealer mascot. Idle on frame 1; when `cheer` increments (a match
// or a stage clear) it plays up to the frame-3 toss-and-cheer pose, then settles
// back to idle. Under reduced motion it holds the cheer pose briefly with no
// continuous animation. Decorative (aria-hidden).
import { useEffect, useRef, useState } from 'react';
import { dealerFrameKey } from '../../config/assets';
import { Art } from './Art';

const SEQ = [1, 2, 2, 1, 0]; // frame indices (0 = idle, 2 = frame-3 cheer)

export function Dealer({
  cheer,
  reduced,
  className,
}: {
  cheer: number;
  reduced: boolean;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const last = useRef(cheer);
  useEffect(() => {
    if (cheer === last.current) return;
    last.current = cheer;
    if (reduced) {
      setFrame(2);
      const id = window.setTimeout(() => setFrame(0), 650);
      return () => window.clearTimeout(id);
    }
    let i = 0;
    setFrame(SEQ[0]);
    const id = window.setInterval(() => {
      i += 1;
      if (i >= SEQ.length) {
        window.clearInterval(id);
        setFrame(0);
      } else {
        setFrame(SEQ[i]);
      }
    }, 130);
    return () => window.clearInterval(id);
  }, [cheer, reduced]);

  return (
    <Art
      imgKey={dealerFrameKey(frame)}
      alt=""
      className={className ? `dealer ${className}` : 'dealer'}
    />
  );
}
