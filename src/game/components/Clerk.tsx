// The clerk-cat mascot. Stands idle on frame 1; when `cheer` increments (a shelf
// cleared or the level was won) it plays the cheer frames once. Under reduced
// motion it briefly shows the cheer pose with no continuous animation.
import { useEffect, useRef, useState } from 'react';
import { clerkFrameKey } from '../../config/assets';
import { Art } from './Art';

const SEQ = [1, 2, 3, 2, 3, 0]; // frame indices → clerkFrameKey (0=idle, 2=box up)

export function Clerk({
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
    }, 110);
    return () => window.clearInterval(id);
  }, [cheer, reduced]);

  return (
    <Art imgKey={clerkFrameKey(frame)} alt="" className={className ? `clerk ${className}` : 'clerk'} />
  );
}
