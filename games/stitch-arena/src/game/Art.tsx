import type {ImageKey} from '../config/assets';
import {useImage} from '../platform/ImagesContext';
export function Art({name,className=''}:{name:ImageKey;className?:string}){const url=useImage(name);return url?<img className={'art '+className} src={url} alt="" draggable={false}/>:<span className={'art art--missing '+className} aria-hidden="true"/>;}
