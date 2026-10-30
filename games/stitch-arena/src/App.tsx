import {useEffect,useRef,useState} from 'react';
import {AudioManager} from './platform/audio';
import {AudioProvider} from './platform/AudioContext';
import {ImagesProvider} from './platform/ImagesContext';
import {I18nProvider,useI18n} from './i18n';
import type {Dict,LangCode} from './i18n/dict';
import {loadLanguages,preloadMedia} from './platform/loader';
import type {ImageKey} from './config/assets';
import {GameScreen} from './game/GameScreen';
import {TitleScreen} from './game/TitleScreen';
function Loading({progress}:{progress:number}){const{t}=useI18n();return <main className="loading"><div className="loading__panel"><h1 className="loading__title">{t('title')}</h1><p role="status">{t('loading',{n:Math.round(progress*100)})}</p><progress aria-label={t('loading',{n:Math.round(progress*100)})} value={progress} max="1"/></div></main>;}
export function App(){const ref=useRef<AudioManager|null>(null);if(!ref.current)ref.current=new AudioManager();const audio=ref.current;const[langs,setLangs]=useState<Record<LangCode,Dict|null>|null>(null),[images,setImages]=useState<Record<ImageKey,string|null>|null>(null),[progress,setProgress]=useState(0),[playing,setPlaying]=useState(false);
useEffect(()=>{let alive=true;loadLanguages().then(async l=>{if(!alive)return;setLangs(l);const m=await preloadMedia(audio,f=>{if(alive)setProgress(f);});if(alive)setImages(m);});return()=>{alive=false;};},[audio]);
useEffect(()=>{const click=(e:Event)=>{if((e.target as Element).closest('button'))audio.playSfx('sfx_click');};const hover=(e:Event)=>{if((e.target as Element).closest('button'))audio.playSfx('sfx_hover');};document.addEventListener('click',click);document.addEventListener('pointerover',hover);return()=>{document.removeEventListener('click',click);document.removeEventListener('pointerover',hover);};},[audio]);
const empty={en:null,'zh-tw':null,'zh-cn':null,ja:null};return <I18nProvider dicts={langs??empty}><AudioProvider manager={audio}>{!images?<Loading progress={progress}/>:<ImagesProvider images={images}>{playing?<GameScreen/>:<TitleScreen onPlay={async()=>{await audio.resume();audio.startBgm();setPlaying(true);}}/>}</ImagesProvider>}</AudioProvider></I18nProvider>;}
