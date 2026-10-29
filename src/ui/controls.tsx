// Shared icon controls (sound, language, restart) used by both the title and game
// screens. Each is a real <button> with a localised accessible name; Btn adds the
// standard hover/click sfx.

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useI18n } from '../i18n/index';
import { audio } from '../platform/audio';
import { useImages, imgUrl } from './assets-context';
import { Btn } from './Btn';
import type { ImageKey } from '../config/assets';

// A labelled button that uses panel_button.png as its plate (falls back to a solid
// red chip if the image failed to load), keeping the text readable on any bg.
export function PlateButton({
  children,
  className,
  silent,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { silent?: boolean; children: ReactNode }) {
  const images = useImages();
  const plate = imgUrl(images, 'panel_button');
  return (
    <Btn className={`plate-btn${className ? ' ' + className : ''}`} silent={silent} {...rest}>
      {plate ? (
        <img className="plate-bg" src={plate} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <span className="img-fallback plate-fb" aria-hidden="true" />
      )}
      <span className="plate-label">{children}</span>
    </Btn>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  className,
}: {
  icon: ImageKey;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const images = useImages();
  const url = imgUrl(images, icon);
  return (
    <Btn className={`icon-btn${className ? ' ' + className : ''}`} aria-label={label} onClick={onClick}>
      {url ? (
        <img src={url} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <span className="img-fallback icon-fb" aria-hidden="true" />
      )}
    </Btn>
  );
}

export function SoundButton() {
  const { t } = useI18n();
  const [muted, setMuted] = useState(audio.muted);
  return (
    <IconBtn
      className="sound-btn"
      icon={muted ? 'icon_sound_off' : 'icon_sound_on'}
      label={muted ? t('aria.soundOff') : t('aria.soundOn')}
      onClick={() => setMuted(audio.toggleMuted())}
    />
  );
}

export function LangButton() {
  const { t, cycleLang } = useI18n();
  return <IconBtn className="lang-btn" icon="icon_language" label={t('aria.language')} onClick={cycleLang} />;
}

export function RestartButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <IconBtn className="restart-btn" icon="icon_restart" label={t('aria.restart')} onClick={onClick} />;
}
