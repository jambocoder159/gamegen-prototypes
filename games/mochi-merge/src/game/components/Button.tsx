// Base button: a real <button> that plays sfx_hover on pointer-enter and
// sfx_click on press. Used for text buttons and (via IconButton) icon buttons.
import type { ReactNode } from 'react';
import { useAudio } from '../../platform/AudioContext';
import { Art } from './Art';
import type { ImageKey } from '../../config/assets';

interface ButtonProps {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  title?: string;
  children: ReactNode;
  autoFocus?: boolean;
}

export function Button({ onClick, className, ariaLabel, ariaPressed, title, children, autoFocus }: ButtonProps) {
  const { manager } = useAudio();
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      className={className}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title ?? ariaLabel}
      onPointerEnter={() => manager.playSfx('sfxHover')}
      onClick={() => {
        manager.playSfx('sfxClick');
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  imgKey,
  label,
  onClick,
  className,
}: {
  imgKey: ImageKey;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      onClick={onClick}
      ariaLabel={label}
      className={className ? `icon-btn ${className}` : 'icon-btn'}
    >
      <Art imgKey={imgKey} alt="" className="icon-btn__img" />
    </Button>
  );
}
