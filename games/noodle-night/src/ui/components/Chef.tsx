import { useImages, imgUrl } from '../assets-context';
import type { ImageKey } from '../../config/assets';

// Ambient cook stirring the pot. Static frame under reduced motion.
export function Chef({ frame }: { frame: number }) {
  const images = useImages();
  const key = `chef_${frame}` as ImageKey;
  const url = imgUrl(images, key);
  if (!url) return <div className="chef chef-fallback" aria-hidden="true" />;
  return <img className="chef" src={url} alt="" aria-hidden="true" draggable={false} />;
}
