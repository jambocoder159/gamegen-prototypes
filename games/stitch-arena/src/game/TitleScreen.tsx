import {useRef} from 'react';
import {useI18n} from '../i18n';
import {useAudio} from '../platform/AudioContext';
import {Art} from './Art';
import {Arena} from './Arena';
import {createMatch} from './sim';
export function TitleScreen({onPlay}:{onPlay:()=>void}){const {t,cycleLang,lang,langName}=useI18n(),{muted,toggleMuted}=useAudio();const demo=useRef(createMatch(42,'ember','frost'));demo.current.countdown=0;return <main className="title game" data-screen="title"><div className="title__demo" aria-hidden="true"><Arena demo match={demo} label={t('demo')}/></div><section className="title__panel"><Art name="logo_base" className="title__logo"/><div className="title__words"><p className="eyebrow">{t('tagline')}</p><h1 className="title__name">{t('title')}</h1><p className="title__tagline">{t('subtitle')}</p></div><button className="primary btn--play" onClick={onPlay}>{t('play')}</button><div className="title__settings"><button onClick={cycleLang}><Art name="icon_language"/>{langName(lang)}</button><button onClick={toggleMuted}><Art name={muted?'icon_mute':'icon_sound'}/>{t(muted?'soundOff':'soundOn')}</button></div></section></main>;}
