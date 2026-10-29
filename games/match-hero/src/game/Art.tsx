import type {ImageKey} from '../config/assets';
import {useImage} from '../platform/ImagesContext';
export function Art({name,className=''}:{name:ImageKey;className?:string}){const src=useImage(name);return src?<img className={`art ${className}`} src={src} alt="" draggable={false}/>:<span className={`art fallback ${className}`} aria-hidden="true"/>;}
// The supplied final contact sheet contains the correct UI; use it unchanged.
const positions={coin:[350,350],sp:[500,522],heart:[980,350],sword:[665,522],fire:[520,350],heal:[815,350],haste:[665,350],upgrade:[815,522],sound:[350,522],language:[1150,350],logo:[970,520]} as const;
export function Icon({name,className=''}:{name:keyof typeof positions;className?:string}){const url=useImage('ui_sheet'),[x,y]=positions[name];return <span aria-hidden="true" className={`icon icon-${name} ${className}`} style={url?{backgroundImage:`url("${url}")`,backgroundPosition:`${-x*(name==='logo'?1:.22)}px ${-y*(name==='logo'?1:.22)}px`,backgroundSize:`${1400*(name==='logo'?1:.22)}px ${696*(name==='logo'?1:.22)}px`}:undefined}/>;}
