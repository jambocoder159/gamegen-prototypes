// Reusable control buttons (sound + language) shared by the title and game
// screens, plus the in-game top-corner cluster.

import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import { GlyphButton, IconButton } from './atoms';

export function SoundButton() {
  const { muted, toggleMute } = useApp();
  const { t } = useI18n();
  return (
    <IconButton
      icon={muted ? 'icon_sound_off' : 'icon_sound_on'}
      label={muted ? t('a11y.unmute') : t('a11y.mute')}
      onClick={toggleMute}
    />
  );
}

export function LanguageButton() {
  const { cycleLang } = useI18n();
  const { t } = useI18n();
  return <IconButton icon="icon_language" label={t('a11y.language')} onClick={cycleLang} />;
}

export function GameControls({
  paused,
  onTogglePause,
  onRestart,
}: {
  paused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="lr-corner lr-corner-tl">
        <GlyphButton
          label={paused ? t('a11y.resume') : t('a11y.pause')}
          onClick={onTogglePause}
        >
          {paused ? (
            <span className="lr-glyph-play" />
          ) : (
            <span className="lr-glyph-pause">
              <i />
              <i />
            </span>
          )}
        </GlyphButton>
        <IconButton icon="icon_restart" label={t('a11y.restart')} onClick={onRestart} />
      </div>
      <div className="lr-corner lr-corner-tr">
        <SoundButton />
        <LanguageButton />
      </div>
    </>
  );
}
