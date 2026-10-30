import { useI18n } from '../../i18n';
import { useAudio } from '../../platform/AudioContext';
import { loadSave, writeSave } from '../save';

/** Native navigation: save synchronously before the browser follows the link. */
export function CatalogLink({ save }: { save?: () => void }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  return (
    <a
      href="../"
      draggable={false}
      className="btn catalog-link"
      onPointerEnter={() => manager.playSfx('sfxHover')}
      onClick={() => {
        manager.playSfx('sfxClick');
        if (save) save();
        else {
          // The title bot owns no player state. Preserve the offline timestamp.
          const saved = loadSave();
          if (saved) writeSave(saved.state, saved.celebrated, saved.savedAt);
        }
        manager.pause();
      }}
    >
      {t('buttons.backToCatalog')}
    </a>
  );
}
