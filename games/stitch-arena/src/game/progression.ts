import {CHARS,STAGES,type Character} from './config';
export interface Progress {version:1;unlocked:Character[];cupStep:number;cupChar:Character;cupDone:boolean;wins:number;coach:boolean;numbers:boolean}
export const PROGRESS_KEY='stitch-arena.progress.v1';
export function newProgress():Progress{return {version:1,unlocked:['ember','frost'],cupStep:0,cupChar:'ember',cupDone:false,wins:0,coach:false,numbers:true};}
export function readProgress(raw:string|null):Progress {const fresh=newProgress();if(!raw||raw.length>3000)return fresh;try{const p=JSON.parse(raw);if(p.version!==1||!Array.isArray(p.unlocked)||p.unlocked.some((c:unknown)=>!CHARS.includes(c as Character))||!p.unlocked.includes('ember')||!p.unlocked.includes('frost')||!Number.isInteger(p.cupStep)||p.cupStep<0||p.cupStep>6||!CHARS.includes(p.cupChar)||!Number.isInteger(p.wins)||p.wins<0||p.wins>1e7||typeof p.cupDone!=='boolean'||typeof p.coach!=='boolean'||typeof p.numbers!=='boolean')return fresh;return p;}catch{return fresh;}}
export function cupOpponent(char:Character,step:number){const others=CHARS.filter(c=>c!==char);return others[step%others.length];}
export function cupStage(step:number){return STAGES[step%3];}
export function cupWin(p:Progress):Character|null {p.cupStep=Math.min(6,p.cupStep+1);p.wins++;const unlock=p.cupStep===2?'gale':p.cupStep===4?'rune':null;if(unlock&&!p.unlocked.includes(unlock)){p.unlocked.push(unlock);return unlock;}if(p.cupStep===6)p.cupDone=true;return null;}
