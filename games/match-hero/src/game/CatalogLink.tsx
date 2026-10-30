import { useI18n } from "../i18n";
import { useAudio } from "../platform/AudioContext";

export function CatalogLink({ onSave }: { onSave: () => void }) {
  const { t } = useI18n(), { manager } = useAudio();
  return (
    <a className="catalog-link" href="../" onClick={() => {
      onSave();
      manager.stopBgm();
    }}>
      {t("backToCatalog")}
    </a>
  );
}
