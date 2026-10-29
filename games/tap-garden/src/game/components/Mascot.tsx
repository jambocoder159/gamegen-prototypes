// The pot mascot, shown on the celebration overlay and the title screen. Uses the
// blooming pot frame; a gentle bob is applied only when motion is allowed.

import { potFrameKey } from '../../config/assets';
import { Art } from './Art';

export function Mascot({
  frame = 4,
  reduced,
  className,
}: {
  frame?: number;
  reduced: boolean;
  className?: string;
}) {
  const cls = `mascot${reduced ? '' : ' mascot--bob'}${className ? ' ' + className : ''}`;
  return <Art imgKey={potFrameKey(frame)} alt="" className={cls} />;
}
