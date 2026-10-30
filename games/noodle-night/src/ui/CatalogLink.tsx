import { useI18n } from '../i18n/index';
import { loadRun, saveRun } from '../game/storage';
import { audio } from '../platform/audio';

// Use a native link so Enter and browser navigation retain their usual behavior.
export function CatalogLink({ onLeave }: { onLeave?: () => void }) {
  const { t } = useI18n();
  return (
    <a
      className="catalog-link"
      href="../"
      onPointerEnter={() => audio.playSfx('sfx_hover')}
      onClick={() => {
        audio.playSfx('sfx_click');
        if (onLeave) onLeave();
        else {
          // The gate/title must preserve the real saved run, never the demo.
          const saved = loadRun();
          if (saved) saveRun(saved);
        }
        audio.setHidden(true);
      }}
    >
      {t('backToCatalog')}
    </a>
  );
}
