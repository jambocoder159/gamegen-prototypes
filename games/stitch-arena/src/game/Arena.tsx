import {useEffect,useRef,type MutableRefObject} from 'react';
import {useImages} from '../platform/ImagesContext';
import {useReducedMotion} from '../platform/reducedMotion';
import {useAudio} from '../platform/AudioContext';
import type {AudioKey} from '../config/assets';
import {CONFIG} from './config';
import {step,createMatch,type Match,type Input} from './sim';
import {aiInput} from './ai';
import {loadArt,render} from './render';
export interface ArenaProps {match:MutableRefObject<Match>;input?:MutableRefObject<Input>;demo?:boolean;paused?:boolean;level?:number;numbers?:boolean;debug?:string;label:string;onUpdate?:(s:Match)=>void;onEvent?:(e:string)=>void;onResult?:(s:Match)=>void;onInputConsumed?:()=>void;onPointer?:(button:number,held:boolean)=>void}
export function Arena(props:ArenaProps){const canvas=useRef<HTMLCanvasElement>(null),urls=useImages(),reduced=useReducedMotion(),{manager}=useAudio();const latest=useRef({...props,reduced});latest.current={...props,reduced};
 useEffect(()=>{const bank=loadArt(urls);let raf=0,last=0,accum=0,ui=0,finished=false;const frame=(now:number)=>{const p=latest.current,el=canvas.current;if(!el)return;const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(!p.paused&&!document.hidden){accum+=dt*(p.debug==='bot'||p.debug==='cup'?12:1);while(accum>=CONFIG.dt){accum-=CONFIG.dt;let s=p.match.current;
   if(s.winner!==null){if(p.demo){p.match.current=createMatch(s.seed,'gale','rune',s.stage==='meadow'?'lantern':s.stage==='lantern'?'ice':'meadow');s=p.match.current;s.countdown=0;}else{if(!finished){finished=true;p.onUpdate?.(s);p.onResult?.(s);}break;}}
   const bot=!!p.demo||p.debug==='bot'||p.debug==='cup';const player=bot?aiInput(s,0,p.debug==='cup'?6:4):p.input!.current;
   step(s,[player,aiInput(s,1,p.debug==='cup'?1:p.level??4)]);if(!bot)p.onInputConsumed?.();
   if(!p.demo)for(const e of s.events){p.onEvent?.(e);let name=e.startsWith('ko')?'ko':e;name=name==='sudden'?'go':name;manager.playSfx(('sfx_'+name) as AudioKey);}
  }}
  render(el,p.match.current,bank,p.reduced,p.numbers??true);if(now-ui>=100){ui=now;p.onUpdate?.(p.match.current);}raf=requestAnimationFrame(frame);
 };raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf);},[urls,manager]);
 return <canvas className={props.demo?'arena arena--demo':'arena'} ref={canvas} role="img" aria-label={props.label} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);props.onPointer?.(e.button,true);}} onPointerUp={e=>props.onPointer?.(e.button,false)} onPointerCancel={()=>{props.onPointer?.(0,false);props.onPointer?.(2,false);}}/>;
}
