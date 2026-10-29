// Renders a ready-made image by asset key. If the image failed to load, renders
// a plain placeholder box (background colour from CSS) so the game never breaks.
import type { CSSProperties } from 'react';
import { useImage } from '../../platform/ImagesContext';
import type { ImageKey } from '../../config/assets';

export function Art({
  imgKey,
  alt,
  className,
  style,
}: {
  imgKey: ImageKey;
  alt: string; // "" → decorative
  className?: string;
  style?: CSSProperties;
}) {
  const src = useImage(imgKey);
  const cls = className ? `${className} art` : 'art';
  if (!src) {
    return (
      <span
        className={`${cls} art--fallback`}
        style={style}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      />
    );
  }
  return (
    <img
      className={cls}
      style={style}
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
    />
  );
}
