import { useI18n } from '../../i18n';
import { useAudio } from '../../platform/AudioContext';
import { loadRun, saveRun } from '../save';

// Native navigation also fires click on keyboard activation. Flush before the
// browser follows the relative URL; title/loading preserve any resumable run.
export function CatalogLink({ onLeave }: { onLeave?: () => void }) {
  const { t } = useI18n();
  const { manager } = useAudio();
  return <a href="../" className="btn catalog-link"
    onPointerEnter={() => manager.playSfx('sfxHover')}
    onClick={() => {
      manager.playSfx('sfxClick');
      if (onLeave) onLeave();
      else if (!new URLSearchParams(location.search).has('stage')) {
        const saved = loadRun();
        if (saved) saveRun(saved);
      }
      manager.suspend();
    }}>{t('buttons.backToCatalog')}</a>;
}
