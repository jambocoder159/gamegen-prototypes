// Title screen: the real game runs behind the logo, played by a bot, endlessly
// restarting, with no HUD and no sfx. Logo + localised title on top, Play +
// sound + language at the bottom.

import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import type { Viewport } from '../platform/viewport';
import { GameCanvas } from './GameCanvas';
import { AssetImg, CatalogLink, TextButton } from './atoms';
import { LanguageButton, SoundButton } from './Controls';

export function TitleScreen({ viewport, onPlay, hasSavedRun, onContinue }: { viewport: Viewport; onPlay: () => void; hasSavedRun: boolean; onContinue: () => void }) {
  const { images, reducedMotion } = useApp();
  const { t } = useI18n();

  return (
    <div className="lr-screen lr-title">
      <GameCanvas
        mode="demo"
        viewport={viewport}
        images={images}
        reducedMotion={reducedMotion}
        seed={20260429}
      />
      <div className="lr-title-vignette" aria-hidden="true" />

      <div className="lr-corner lr-corner-tr">
        <SoundButton />
        <LanguageButton />
      </div>

      <div className="lr-title-top">
        <AssetImg k="logo_base" className="lr-logo" alt="" />
        <h1 className="lr-title-text">{t('title')}</h1>
        <p className="lr-tagline">{t('tagline')}</p>
      </div>

      <div className="lr-title-bottom">
        <div className={`lr-title-actions${hasSavedRun ? ' lr-has-save' : ''}`}>
          {hasSavedRun && <TextButton className="lr-primary lr-continue" onClick={onContinue}>{t('continue')}</TextButton>}
          <TextButton className="lr-primary lr-play" label={t(hasSavedRun ? 'newGame' : 'a11y.play')} onClick={onPlay}>
            {t(hasSavedRun ? 'newGame' : 'play')}
          </TextButton>
        </div>
        <CatalogLink />
        <p className="lr-help">{t('help')}</p>
      </div>
    </div>
  );
}
