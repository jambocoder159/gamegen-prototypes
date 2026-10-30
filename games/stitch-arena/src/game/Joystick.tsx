import {useRef,useState,type PointerEvent} from 'react';
import type {Input} from './sim';
export function Joystick({label,onChange}:{label:string;onChange:(fields:(keyof Input)[])=>void}){
 const pointer=useRef<number|null>(null),origin=useRef({x:0,y:0});
 const [visual,setVisual]=useState<{x:number;y:number;dx:number;dy:number}|null>(null);
 const move=(e:PointerEvent<HTMLDivElement>)=>{if(pointer.current!==e.pointerId)return;const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y,length=Math.hypot(dx,dy),scale=length>42?42/length:1;
  setVisual({x:origin.current.x-e.currentTarget.getBoundingClientRect().left,y:origin.current.y-e.currentTarget.getBoundingClientRect().top,dx:dx*scale,dy:dy*scale});
  const fields:(keyof Input)[]=[];if(Math.abs(dx)>42*.18)fields.push(dx>0?'right':'left');if(dy>42*.4)fields.push('down');if(dy< -42*.4)fields.push('aimUp');onChange(fields);
 };
 const release=(e:PointerEvent<HTMLDivElement>)=>{if(pointer.current!==e.pointerId)return;pointer.current=null;setVisual(null);onChange([]);};
 return <div className="touch-controls joystick-zone" role="region" aria-label={label} onPointerDown={e=>{if(pointer.current!==null)return;e.preventDefault();pointer.current=e.pointerId;const r=e.currentTarget.getBoundingClientRect();origin.current={x:Math.max(r.left+52,Math.min(r.right-52,e.clientX)),y:Math.max(r.top+52,Math.min(r.bottom-52,e.clientY))};e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e=>e.preventDefault()}>
  <div className={'joystick-base'+(visual?' is-held':'')} aria-hidden="true" style={visual?{left:visual.x,top:visual.y}:undefined}><div className="joystick-knob" style={{transform:`translate(${visual?.dx??0}px, ${visual?.dy??0}px)`}}/></div>
 </div>;
}
