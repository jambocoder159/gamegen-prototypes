import { createContext, useContext } from 'react';
import type { ImageKey } from '../config/assets';

export type ImageMap = Partial<Record<ImageKey, string>>;

export const AssetsContext = createContext<ImageMap>({});

export function useImages(): ImageMap {
  return useContext(AssetsContext);
}

/** URL for an image key, or '' when it failed to load (caller shows a placeholder). */
export function imgUrl(map: ImageMap, key: ImageKey): string {
  return map[key] || '';
}
