// Real preload progress; completion automatically reveals the single title screen.
import { useI18n } from '../i18n';
export function LoadingScreen({ progress }: { progress: number }) {
  const { t } = useI18n();
  return <main className="loading"><div className="loading__box">
    <div className="loading__title">{t('game.title')}</div>
    <div className="loading__slot" role="status"><span className="loading__pct">{t('loading.progress', { pct: Math.round(progress * 100) })}</span></div>
  </div></main>;
}
