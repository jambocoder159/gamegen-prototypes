import type { ImageKey } from "../config/assets";
import { useImage } from "../platform/ImagesContext";
export function Art({
  name,
  className = "",
}: {
  name: ImageKey;
  className?: string;
}) {
  const src = useImage(name);
  return src ? (
    <img className={`art ${className}`} src={src} alt="" draggable={false} />
  ) : (
    <span className={`art fallback ${className}`} aria-hidden="true" />
  );
}
export type IconName =
  | "coin"
  | "sp"
  | "heart"
  | "sword"
  | "fire"
  | "heal"
  | "haste"
  | "lock"
  | "shield"
  | "sound"
  | "language"
  | "upgrade"
  | "rebirth"
  | "relic_feather"
  | "relic_ring"
  | "danger"
  | "logo";
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <Art
      name={name === "logo" ? "logo_base" : `icon_${name}`}
      className={`icon icon-${name} ${className}`}
    />
  );
}
