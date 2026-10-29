import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { audio } from '../platform/audio';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Suppress hover/click sfx (used by the title demo's inert controls). */
  silent?: boolean;
};

// Every interactive control in the game is a real <button> and plays the shared
// hover/click sfx (DEV_SPEC §7), unless `silent`.
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { silent, onPointerEnter, onClick, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      onPointerEnter={(e) => {
        if (!silent && !rest.disabled) audio.playSfx('sfx_hover');
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        if (!silent && !rest.disabled) audio.playSfx('sfx_click');
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});
