import {useI18n} from '../i18n';
import {useAudio} from '../platform/AudioContext';
import {leaveLandscape} from '../platform/touch';

export function CatalogLink({save}:{save?:()=>void}){
 const {t}=useI18n(),{manager}=useAudio();
 return <a className="catalog-link" href="../" onPointerEnter={()=>manager.playSfx('sfx_hover')} onClick={()=>{
  manager.playSfx('sfx_click');
  // Both APIs are invoked before leaveLandscape's first await. Do not delay
  // the synchronous save or the anchor's native navigation on their promises.
  void leaveLandscape();
  save?.();
  manager.pauseForPageHide();
 }}>{t('backToCatalog')}</a>;
}
