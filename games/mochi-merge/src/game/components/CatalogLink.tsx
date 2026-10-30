import { useI18n } from '../../i18n';
import { useAudio } from '../../platform/AudioContext';

export function CatalogLink({ onBeforeLeave }: { onBeforeLeave: () => void }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  return (
    <a
      href="../"
      className="btn catalog-link"
      onPointerEnter={() => manager.playSfx('sfxHover')}
      onClick={() => {
        manager.playSfx('sfxClick');
        onBeforeLeave();
        manager.pause();
      }}
    >
      {t('buttons.backToCatalog')}
    </a>
  );
}
