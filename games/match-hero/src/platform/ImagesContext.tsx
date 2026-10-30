import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { ImageKey } from "../config/assets";

const Ctx = createContext<Record<ImageKey, string | null> | null>(null);

export function ImagesProvider({
  images,
  children,
}: {
  images: Record<ImageKey, string | null>;
  children: ReactNode;
}) {
  return <Ctx.Provider value={images}>{children}</Ctx.Provider>;
}

/** Resolved URL for an image key, or null if it failed to load (→ placeholder). */
export function useImage(key: ImageKey): string | null {
  const m = useContext(Ctx);
  return m ? m[key] : null;
}

export function useImages() {
  const images = useContext(Ctx);
  if (!images) throw new Error("ImagesProvider missing");
  return images;
}
