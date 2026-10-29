// A reusable accessible modal dialog (role="dialog", aria-modal). It traps focus
// inside while open, moves first focus to the first focusable control (or the
// heading), restores focus to the previously-focused element on close, closes on
// Escape, and exposes an aria-live region (polite) for announcing action results
// (e.g. purchase outcomes). The whole surface is a bottom sheet / full card styled
// in CSS; this component only owns behaviour + structure.

import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  onClose,
  children,
  live,
  className,
  titleIcon,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  live?: string; // polite announcement text (purchase results etc.)
  className?: string;
  titleIcon?: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // first focus + restore on unmount
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = ref.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div className="overlay overlay--sheet" onKeyDown={onKeyDown}>
      <div
        className={`dialog${className ? ' ' + className : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="dialog__bar">
          <h2 className="dialog__title" id={titleId}>
            {titleIcon}
            <span>{title}</span>
          </h2>
          <Button className="icon-btn dialog__close" ariaLabel={t('buttons.close')} onClick={onClose}>
            <span aria-hidden className="dialog__x">
              ✕
            </span>
          </Button>
        </div>
        <div className="dialog__body" tabIndex={0}>{children}</div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live ?? ''}
        </div>
      </div>
    </div>
  );
}
