// Reusable on-screen controls: the sound toggle and the language menu. (The play
// screen composes its own controls row; the title screen uses these two.)
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { useAudio } from '../../platform/AudioContext';
import { Button, IconButton } from './Button';

export function SoundControl() {
  const { t } = useI18n();
  const { muted, toggleMuted } = useAudio();
  return (
    <IconButton
      imgKey={muted ? 'iconSoundOff' : 'iconSoundOn'}
      label={muted ? t('buttons.unmute') : t('buttons.mute')}
      onClick={toggleMuted}
    />
  );
}

export function LanguageControl() {
  const { t, lang, setLang, codes, langName } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lang" ref={ref}>
      <IconButton
        imgKey="iconLanguage"
        label={t('buttons.language')}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul className="lang__menu">
          {codes.map((c) => (
            <li key={c} role="none">
              <Button
                className={`lang__item${c === lang ? ' lang__item--active' : ''}`}
                ariaPressed={c === lang}
                onClick={() => {
                  setLang(c);
                  setOpen(false);
                }}
              >
                {langName(c)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
