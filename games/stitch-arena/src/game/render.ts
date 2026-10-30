import {CONFIG as C} from './config';
import {camera,platforms,type Match} from './sim';
import type {ImageKey} from '../config/assets';
export type ArtBank=Partial<Record<ImageKey,HTMLImageElement>>;
export function loadArt(urls:Record<ImageKey,string|null>):ArtBank {const bank:ArtBank={};for(const [key,url] of Object.entries(urls)){if(url){const img=new Image();img.src=url;bank[key as ImageKey]=img;}}return bank;}
interface PuppetMotion {angle:number;angular:number;stretch:number;elastic:number;grounded:boolean;vx:number;stun:number}
const motions=new WeakMap<HTMLCanvasElement,{tick:number;puppets:PuppetMotion[]}>();
export function render(canvas:HTMLCanvasElement,s:Match,bank:ArtBank,reduced:boolean,numbers:boolean){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,3),w=rect.width,h=rect.height;
 if(!w||!h)return;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 function art(key:string,x:number,y:number,aw:number,ah:number){const im=bank[key as ImageKey];if(im?.complete&&im.naturalWidth)ctx!.drawImage(im,x,y,aw,ah);else{ctx!.fillStyle='#c7c9b8';ctx!.fillRect(x,y,aw,ah);}}
 const bg=bank[`bg_${s.stage}`];if(bg?.complete&&bg.naturalWidth){const scale=Math.max(w/bg.width,h/bg.height);art(`bg_${s.stage}`,(w-bg.width*scale)/2,(h-bg.height*scale)/2,bg.width*scale,bg.height*scale);}else{ctx.fillStyle='#709b91';ctx.fillRect(0,0,w,h);}
 let motion=motions.get(canvas);if(!motion||s.tick<motion.tick){motion={tick:s.tick,puppets:s.fighters.map(f=>({angle:0,angular:0,stretch:1,elastic:0,grounded:f.grounded,vx:f.vx,stun:f.stun}))};motions.set(canvas,motion);}const delta=Math.max(0,Math.min(.05,(s.tick-motion.tick)/60));motion.tick=s.tick;
 const cam=camera(s,w/h);if(reduced){const cx=cam.x+cam.w/2,cy=cam.y+cam.h/2;const fixed=w/h<1.3?900:1200;cam.w=fixed;cam.h=fixed/(w/h);cam.x=cx-cam.w/2;cam.y=cy-cam.h/2;}const scale=w/cam.w;ctx.save();ctx.scale(scale,scale);ctx.translate(-cam.x,-cam.y);
 for(const p of platforms(s)){const kind=p.main?'main':'small',im=bank[`plat_${s.stage}_${kind}`];const ph=im?p.w*im.height/im.width:p.w*.35;art(`plat_${s.stage}_${kind}`,p.x,p.y-p.w*C.surfaceInset[s.stage][kind],p.w,ph);}
 if(s.spool)art('fx_spool',s.spool.x-25,s.spool.y-27+(reduced?0:Math.sin(s.time*4)*5),50,50);
 if(s.stage==='lantern'&&(s.scissors.warning>0||s.scissors.active>0)){ctx.globalAlpha=s.scissors.warning>0?.4:1;art('fx_scissors',s.scissors.x-60,s.scissors.warning>0?535:250+(1-s.scissors.active/.35)*350,120,145);ctx.globalAlpha=1;}
 if(s.stage==='ice'&&s.time>=C.unravelStart&&!reduced){ctx.globalAlpha=.4;for(let n=0;n<14;n++){const x=cam.x+((n*127+s.time*18)%cam.w),y=cam.y+((n*97+s.time*42)%cam.h);art('fx_ice',x,y,15,10);}ctx.globalAlpha=1;}
 for(const p of s.projectiles){const key={ember:'fire',frost:'ice',gale:'wind',rune:'rock'}[p.kind];ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));const pw=p.wave?140:p.kind==='gale'?90:64;art('fx_'+key,-pw/2,-30,pw,60);ctx.restore();}
 for(const [index,f] of s.fighters.entries()){if(f.respawn>0||f.stocks<=0)continue;ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.face,1);const m=motion.puppets[index];if(delta>0&&!reduced){if(f.grounded&&!m.grounded){m.stretch=.84;m.elastic=0;}if(!f.grounded&&m.grounded&&f.vy<0){m.stretch=1.12;m.elastic=0;}const acceleration=(f.vx-m.vx)/delta,target=Math.max(-.18,Math.min(.18,acceleration/16000+f.vx/5000));m.angular+=((target-m.angle)*100-m.angular*13)*delta;m.angle+=m.angular*delta;m.elastic+=((1-m.stretch)*130-m.elastic*12)*delta;m.stretch+=m.elastic*delta;if(f.stun>m.stun)m.angular+=Math.sign(f.vx)*2;}m.grounded=f.grounded;m.vx=f.vx;m.stun=f.stun;
 const tilt=reduced?0:f.pose==='tumble'?Math.sin(s.time*9)*.8:m.angle;ctx.rotate(tilt);
 if(f.invuln>0)ctx.globalAlpha=reduced?.7:s.tick%12<6?.4:1;
 const im=bank[`${f.char}_${f.pose}` as ImageKey],height=C.visualHeight;const aw=im?height*im.width/im.height:height;const wobble=reduced?1:Math.max(.8,Math.min(1.18,m.stretch));ctx.scale(1/wobble,wobble);art(`${f.char}_${f.pose}`,-aw/2,-height+height*8/(im?.height||280),aw,height);
 ctx.restore();if(f.shield>0)art('fx_shield',f.x-64,f.y-135,128,140);
 }
 for(const e of s.effects){if(e.kind==='hook'){ctx.strokeStyle='#ed4d9c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.tx,e.ty);ctx.stroke();art('fx_spool',e.tx-16,e.ty-16,32,32);}else if(e.kind==='hit'){ctx.globalAlpha=e.life/.45;art('fx_hit',e.x-42,e.y-42,84,84);ctx.globalAlpha=1;}else if(numbers){ctx.font='bold 25px system-ui';ctx.textAlign='center';ctx.fillStyle='#102c33';ctx.fillText('+'+e.n+'%',e.x,e.y-(.45-e.life)*80);}}
 ctx.restore();
 for(const f of s.fighters){if(f.stocks<=0||f.respawn>0)continue;const x=(f.x-cam.x)*scale,y=(f.y-65-cam.y)*scale;if(x<15||x>w-15||y<15||y>h-15){ctx.save();ctx.translate(Math.max(22,Math.min(w-22,x)),Math.max(22,Math.min(h-22,y)));ctx.rotate(Math.atan2(y-h/2,x-w/2)+Math.PI/2);art('icon_jump',-20,-20,40,40);ctx.restore();const distance=Math.round(Math.hypot(Math.max(0,-x,x-w),Math.max(0,-y,y-h))/scale);const lx=Math.max(28,Math.min(w-28,x)),ly=Math.max(48,Math.min(h-8,y+35));ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.strokeStyle='#173e43';ctx.fillStyle='#fff8e7';ctx.lineWidth=3;ctx.strokeText(String(distance),lx,ly);ctx.fillText(String(distance),lx,ly);}}
}
