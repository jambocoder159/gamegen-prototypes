import { useI18n } from '../../i18n';
import { useAudio } from '../../platform/AudioContext';
import { loadProgress, saveProgress } from '../progress';
import { loadRun, saveRun } from '../run';

// The title keeps an existing run; play supplies its current, unthrottled save.
function saveTitle() {
  saveProgress(loadProgress());
  const run = loadRun();
  if (run) saveRun(run);
}

export function CatalogLink({ onSave = saveTitle }: { onSave?: () => void }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  return (
    <a
      href="../"
      className="btn catalog-link"
      onPointerEnter={() => manager.playSfx('sfxHover')}
      onClick={() => {
        manager.playSfx('sfxClick');
        onSave();
        manager.suspend();
      }}
    >
      {t('buttons.catalog')}
    </a>
  );
}
