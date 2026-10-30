import {restore,serialize,SAVE_KEY,type Match} from './sim';
export type Mode='duel'|'cup';
export interface SavedMatch {match:Match;mode:Mode;level:number;cupStep:number}
export function getItem(key:string):string|null{try{return localStorage.getItem(key);}catch{return null;}}
export function setItem(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* storage unavailable */}}
export function clearMatch(){try{localStorage.removeItem(SAVE_KEY);}catch{/* storage unavailable */}}
export function readMatch():SavedMatch|null {const raw=getItem(SAVE_KEY);if(!raw||raw.length>85000)return null;try{const v=JSON.parse(raw);const match=restore(JSON.stringify(v.match));if(!match||match.winner!==null||!['duel','cup'].includes(v.mode)||!Number.isInteger(v.level)||v.level<1||v.level>6||!Number.isInteger(v.cupStep)||v.cupStep<0||v.cupStep>5)return null;return {match,mode:v.mode,level:v.level,cupStep:v.cupStep};}catch{return null;}}
export function writeMatch(s:SavedMatch){setItem(SAVE_KEY,JSON.stringify({...s,match:JSON.parse(serialize(s.match))}));}
