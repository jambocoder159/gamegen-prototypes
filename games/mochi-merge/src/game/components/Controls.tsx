// On-screen controls: restart, sound toggle, and a language menu.
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
        <ul className="lang__menu" aria-label={t('buttons.language')}>
          {codes.map((c) => (
            <li key={c}>
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

/** In-game controls. */
export function Controls({ onRestart, onHelp, className }: { onRestart: () => void; onHelp: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={className ? `controls ${className}` : 'controls'}>
      <IconButton imgKey="iconRestart" label={t('buttons.restart')} onClick={onRestart} />
      <SoundControl />
      <LanguageControl />
      <Button className="icon-btn help-btn" ariaLabel={t('coach.help')} onClick={onHelp}>?</Button>
    </div>
  );
}
