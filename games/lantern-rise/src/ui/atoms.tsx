// Small shared UI atoms: an image that degrades to a plain placeholder when the
// asset failed to load, and buttons that announce themselves and play the
// standard hover/click sfx (platform rule 7). Every button is a real <button>.

import { useApp } from '../app/AppContext';
import { audio } from '../platform/audio';
import type { ImageKey } from '../config/assets';

export function AssetImg({
  k,
  className,
  alt = '',
}: {
  k: ImageKey;
  className?: string;
  alt?: string;
}) {
  const { images } = useApp();
  const img = images.get(k);
  const decorative = alt === '';
  if (!img) {
    return (
      <div
        className={`lr-img-fallback ${className ?? ''}`}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
      />
    );
  }
  return (
    <img
      className={className}
      src={img.currentSrc || img.src}
      alt={alt}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
    />
  );
}

function withSfx<T extends (...a: never[]) => void>(fn?: T) {
  return {
    onPointerEnter: () => audio.play('sfx_hover', 0.3),
    onClick: (e: React.MouseEvent) => {
      audio.play('sfx_click', 0.5);
      (fn as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
  };
}

export function IconButton({
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
  return (
    <button
      type="button"
      className={`lr-iconbtn ${className ?? ''}`}
      aria-label={label}
      title={label}
      {...withSfx(onClick)}
    >
      <AssetImg k={icon} className="lr-iconbtn-img" />
    </button>
  );
}

// A disc button whose face is a CSS-drawn UI glyph (used for pause/resume,
// which has no supplied icon). This is a control affordance, not game art.
export function GlyphButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`lr-iconbtn lr-glyphbtn ${className ?? ''}`}
      aria-label={label}
      title={label}
      {...withSfx(onClick)}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`lr-textbtn ${className ?? ''}`}
      aria-label={label}
      {...withSfx(onClick)}
    >
      {children}
    </button>
  );
}
