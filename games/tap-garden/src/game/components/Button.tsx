// Base button: a real <button> that plays sfx_hover on pointer-enter and
// sfx_click on press. Used for text buttons and (via IconButton) icon buttons.
// `dimmed` marks a button whose action is currently unavailable: it stays
// focusable and reports aria-disabled, dims via opacity, and its handler gives
// feedback rather than failing silently.
import type { ReactNode, RefObject } from 'react';
import { useAudio } from '../../platform/AudioContext';
import { Art } from './Art';
import type { ImageKey } from '../../config/assets';

interface ButtonProps {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  dimmed?: boolean;
  title?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

export function Button({
  onClick,
  className,
  ariaLabel,
  ariaPressed,
  dimmed,
  title,
  buttonRef,
  children,
}: ButtonProps) {
  const { manager } = useAudio();
  const cls = `${className ?? ''}${dimmed ? ' is-dim' : ''}`.trim();
  return (
    <button
      type="button"
      ref={buttonRef}
      className={cls || undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-disabled={dimmed || undefined}
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
