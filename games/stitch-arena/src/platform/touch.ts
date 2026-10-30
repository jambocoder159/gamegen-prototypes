// Input capability, never window size: a narrow keyboard desktop remains a desktop.
export function isTouchDevice(){return !matchMedia('(pointer: fine)').matches&&(navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches);}
type WebkitElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void};
type WebkitDocument=Document&{webkitExitFullscreen?:()=>Promise<void>|void;webkitFullscreenElement?:Element};
type LockableOrientation=ScreenOrientation&{lock?:(orientation:string)=>Promise<void>};
export function inFullscreen(){return !!(document.fullscreenElement||(document as WebkitDocument).webkitFullscreenElement);}
export async function enterLandscape(){
 if(!isTouchDevice())return;
 try{if(!inFullscreen()){const root=document.documentElement as WebkitElement;if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});else await root.webkitRequestFullscreen?.();}}catch{/* Denial and unsupported iOS element fullscreen are harmless. */}
 try{await (screen.orientation as LockableOrientation|undefined)?.lock?.('landscape');}catch{/* Rotation overlay is the fallback. */}
}
export async function leaveLandscape(){
 try{screen.orientation?.unlock?.();}catch{/* Optional API. */}
 try{if(inFullscreen()){if(document.exitFullscreen)await document.exitFullscreen();else await (document as WebkitDocument).webkitExitFullscreen?.();}}catch{/* Optional API. */}
}
