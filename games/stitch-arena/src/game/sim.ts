import {CHARS,CONFIG as C,STAGES,type Character,type Stage} from './config';
export interface Input {left:boolean;right:boolean;up:boolean;down:boolean;punch:boolean;spell:boolean;hook:boolean;aimUp:boolean;aimDown:boolean}
export const idleInput=():Input=>({left:false,right:false,up:false,down:false,punch:false,spell:false,hook:false,aimUp:false,aimDown:false});
export interface Fighter {char:Character;x:number;y:number;vx:number;vy:number;face:number;fray:number;stocks:number;jumps:number;grounded:boolean;stun:number;invuln:number;respawn:number;burn:number;chill:number;shield:number;punchCd:number;spellCd:number;hookCd:number;pose:string;poseTime:number;wasUp:boolean;kos:number;maxFray:number;hits:number;hooks:number}
export interface Platform {x:number;y:number;w:number;main:boolean}
export interface Projectile {id:number;owner:number;kind:Character;x:number;y:number;vx:number;vy:number;life:number;wave:boolean}
export interface Effect {kind:'hit'|'hook'|'number';x:number;y:number;tx:number;ty:number;life:number;n:number}
export interface AIState {next:number;input:Input;lastJump:number}
export interface Match {version:1;seed:number;tick:number;time:number;countdown:number;stage:Stage;fighters:[Fighter,Fighter];projectiles:Projectile[];effects:Effect[];spool:{x:number;y:number;life:number}|null;nextSpool:number;scissors:{x:number;warning:number;active:number};nextScissors:number;sudden:boolean;winner:number|null;events:string[];ai:[AIState,AIState];nextId:number}
export function random(s:{seed:number}):number {s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function fighter(char:Character,x:number,face:number,stocks:number):Fighter {return {char,x,y:500,vx:0,vy:0,face,fray:0,stocks,jumps:0,grounded:false,stun:0,invuln:0,respawn:0,burn:0,chill:0,shield:0,punchCd:0,spellCd:0,hookCd:0,pose:'idle1',poseTime:0,wasUp:false,kos:0,maxFray:0,hits:0,hooks:0};}
export function createMatch(seed=1,a:Character='ember',b:Character='frost',stage:Stage='meadow',stocks:number=C.stocks):Match {return {version:1,seed:seed>>>0,tick:0,time:0,countdown:C.countdown,stage,fighters:[fighter(a,650,1,stocks),fighter(b,950,-1,stocks)],projectiles:[],effects:[],spool:null,nextSpool:14,scissors:{x:800,warning:0,active:0},nextScissors:7,sudden:false,winner:null,events:[],ai:[{next:0,input:idleInput(),lastJump:0},{next:0,input:idleInput(),lastJump:0}],nextId:0};}
export function platforms(s:Match):Platform[] {
 if(s.stage==='meadow'){const offset=Math.sin(s.time*Math.PI/3)*120;return [{x:440,y:620,w:720,main:true},{x:470+offset,y:430,w:180,main:false},{x:950-offset,y:430,w:180,main:false}];}
 if(s.stage==='lantern')return [{x:400,y:640,w:800,main:true},{x:710,y:420,w:180,main:false}];
 const w=Math.max(C.unravelMin,560-Math.max(0,s.time-C.unravelStart)*C.unravelSpeed*2);
 return [{x:800-w/2,y:620,w,main:true},{x:330,y:440,w:180,main:false},{x:1090,y:440,w:180,main:false}];
}
function fx(s:Match,kind:Effect['kind'],x:number,y:number,n=0,tx=x,ty=y){s.effects.push({kind,x,y,tx,ty,n,life:kind==='hook'?.25:.45});}
export function hit(s:Match,target:number,damage:number,base:number,scale:number,dx:number,dy:number,owner:number){
 const f=s.fighters[target];if(f.respawn>0||f.stocks<=0||f.invuln>0)return false;
 if(f.shield>0){f.shield=0;s.events.push('shield');return false;}
 f.fray=Math.min(300,f.fray+damage);f.maxFray=Math.max(f.maxFray,f.fray);
 const k=(base+f.fray*scale)/C.chars[f.char].weight;const length=Math.hypot(dx,dy)||1;
 f.vx=dx/length*k;f.vy=dy/length*k;f.grounded=false;f.stun=Math.min(C.hitstun.max,C.hitstun.min+k/C.hitstun.divisor);f.pose='hurt';f.poseTime=.3;
 if(owner>=0)s.fighters[owner].hits++;fx(s,'hit',f.x,f.y-60);fx(s,'number',f.x,f.y-120,damage);s.events.push('hit');return true;
}
export function cast(s:Match,i:number,input:Input){const f=s.fighters[i],c=C.chars[f.char];f.spellCd=c.spellCd;f.pose='cast';f.poseTime=.3;
 const a=input.aimUp?-Math.PI/4:input.aimDown?Math.PI/4:0;
 s.projectiles.push({id:s.nextId++,owner:i,kind:f.char,x:f.x+f.face*50,y:f.y-60,vx:Math.cos(a)*c.projectile*f.face,vy:f.char==='rune'?-560+Math.sin(a)*300:Math.sin(a)*c.projectile,life:2.2,wave:false});s.events.push('cast_'+({ember:'fire',frost:'ice',gale:'wind',rune:'rock'}[f.char]));}
export function hook(s:Match,i:number){const f=s.fighters[i],e=s.fighters[1-i];f.hookCd=C.hook.cooldown;f.pose='cast';f.poseTime=.25;s.events.push('hook');
 const dx=e.x-f.x,dy=e.y-f.y;
 if(e.respawn<=0&&e.stocks>0&&dx*f.face>0&&Math.hypot(dx,dy)<C.hook.range&&Math.abs(dy)<Math.abs(dx)*.577+35){
  const did=hit(s,1-i,C.hook.damage,110,0,-f.face,-.2,i);if(did){e.x=f.x+f.face*80;e.y=f.y;e.vx=-f.face*100;e.vy=-100;f.hooks++;}fx(s,'hook',f.x,f.y-60,0,e.x,e.y-60);return 'enemy';
 }
 if(!f.grounded){let best:{x:number;y:number;d:number}|null=null;for(const p of platforms(s))for(const x of [p.x+30,p.x+p.w-30]){const d=Math.hypot(f.x-x,f.y-p.y);if(d<C.hook.range&&(!best||d<best.d))best={x,y:p.y,d};}
  if(best){fx(s,'hook',f.x,f.y-60,0,best.x,best.y);f.x=best.x;f.y=best.y-20;f.vx=0;f.vy=-300;f.jumps=1;f.hooks++;return 'rescue';}}
 f.hookCd=C.hook.miss;fx(s,'hook',f.x,f.y-60,0,f.x+f.face*160,f.y-60);return 'miss';
}
function ko(s:Match,i:number){const f=s.fighters[i];f.stocks--;f.respawn=C.respawn;f.fray=0;f.burn=0;f.chill=0;f.shield=0;f.vx=0;f.vy=0;s.fighters[1-i].kos++;s.events.push('ko'+i);if(f.stocks===0||s.sudden)s.winner=1-i;}
export function step(s:Match,inputs:[Input,Input]):Match {
 s.events=[];if(s.winner!==null)return s;s.tick++;
 if(s.countdown>0){const before=Math.ceil(s.countdown);s.countdown=Math.max(0,s.countdown-C.dt);if(Math.ceil(s.countdown)<before)s.events.push(s.countdown===0?'go':'count');return s;}
 s.time+=C.dt;const ps=platforms(s);
 s.effects=s.effects.filter(e=>(e.life-=C.dt)>0);
 for(let i=0;i<2;i++){
  const f=s.fighters[i],input=inputs[i],c=C.chars[f.char];if(f.stocks<=0)continue;
  if(f.respawn>0){f.respawn-=C.dt;if(f.respawn<=0){Object.assign(f,{x:i===0?650:950,y:300,vx:0,vy:0,invuln:C.invuln,jumps:0,stun:0});}continue;}
  for(const key of ['stun','invuln','chill','shield','punchCd','spellCd','hookCd','poseTime'] as const)f[key]=Math.max(0,f[key]-C.dt);
  if(f.burn>0){f.burn=Math.max(0,f.burn-C.dt);f.fray=Math.min(300,f.fray+C.burn.rate*C.dt);f.maxFray=Math.max(f.maxFray,f.fray);}
  if(f.stun===0){
   const dir=Number(input.right)-Number(input.left);if(dir){f.face=dir;const speed=c.speed*(f.chill>0&&f.char!=='rune'?C.chill.speedFactor:1);f.vx=Math.max(-speed,Math.min(speed,f.vx+dir*C.acceleration*C.dt));}
   else {const friction=(f.grounded?C.friction:C.airFriction)*(s.stage==='ice'&&f.char!=='frost'?.4:1)*C.dt;f.vx=Math.sign(f.vx)*Math.max(0,Math.abs(f.vx)-friction);}
   if(input.up&&!f.wasUp&&f.jumps<2){f.vy=-c.jump;f.jumps++;f.grounded=false;f.pose='jump';f.poseTime=.2;s.events.push('jump');}
   if(input.punch&&f.punchCd===0){f.punchCd=C.punch.cooldown;f.pose='punch';f.poseTime=.2;s.events.push('punch');const e=s.fighters[1-i],dx=e.x-f.x;
    if(dx*f.face>=-20&&Math.abs(dx)<C.punch.range&&Math.abs(e.y-f.y)<100)hit(s,1-i,C.punch.damage,C.punch.base,C.punch.scale,input.aimUp?f.face*.35:f.face,input.aimDown?.7:input.aimUp?-1:-.55,i);}
   if(input.spell&&f.spellCd===0)cast(s,i,input);
   if(input.hook&&f.hookCd===0)hook(s,i);
  }
  f.wasUp=input.up;const oldY=f.y;
  f.vy=Math.min(C.fallMax,f.vy+C.gravity*C.dt*(f.char==='gale'&&input.up&&f.vy>0&&f.stun===0?.3:1));f.x+=f.vx*C.dt;f.y+=f.vy*C.dt;f.grounded=false;
  if(f.vy>=0&&!input.down){for(const p of ps){if(oldY<=p.y+1&&f.y>=p.y&&f.x>=p.x-12&&f.x<=p.x+p.w+12){f.y=p.y;f.vy=0;f.grounded=true;f.jumps=0;break;}}}
  if(f.poseTime===0)f.pose=f.stun>0?(Math.hypot(f.vx,f.vy)>850?'tumble':'hurt'):!f.grounded?'jump':Math.abs(f.vx)>35?'run':s.tick%60<30?'idle1':'idle2';
  if(f.x<C.blast.left||f.x>C.blast.right||f.y<C.blast.top||f.y>C.blast.bottom)ko(s,i);
 }
 for(const p of s.projectiles){p.life-=C.dt;p.x+=p.vx*C.dt;p.y+=p.vy*C.dt;if(p.kind==='rune'&&!p.wave){p.vy+=C.rock.gravity*C.dt;for(const plat of ps){if(p.vy>0&&p.y>=plat.y&&p.y-p.vy*C.dt<=plat.y&&p.x>=plat.x&&p.x<=plat.x+plat.w){p.wave=true;p.y=plat.y-15;p.vx=Math.sign(p.vx)*C.rock.waveSpeed;p.vy=0;p.life=C.rock.waveLife;}}}
  const e=s.fighters[1-p.owner];if(Math.abs(e.x-p.x)<(p.wave?90:48)&&Math.abs(e.y-55-p.y)<65){const c=C.chars[p.kind];if(hit(s,1-p.owner,c.damage,c.base,c.scale,Math.sign(p.vx),p.kind==='gale'?-.23:-.65,p.owner)){if(p.kind==='ember')e.burn=C.burn.duration;if(p.kind==='frost'&&e.char!=='rune')e.chill=C.chill.duration;}p.life=0;}}
 for(let a=0;a<s.projectiles.length;a++)for(let b=a+1;b<s.projectiles.length;b++){const p=s.projectiles[a],q=s.projectiles[b];if(p.owner!==q.owner&&p.life>0&&q.life>0&&['ember','frost'].includes(p.kind)&&['ember','frost'].includes(q.kind)&&Math.hypot(p.x-q.x,p.y-q.y)<55){p.life=0;q.life=0;fx(s,'hit',p.x,p.y);}}
 s.projectiles=s.projectiles.filter(p=>p.life>0);
 if(s.spool){s.spool.life-=C.dt;for(const f of s.fighters){if(f.respawn<=0&&Math.hypot(f.x-s.spool.x,f.y-45-s.spool.y)<70){f.shield=C.shield;f.spellCd=0;f.hookCd=0;f.punchCd=0;s.spool.life=0;s.events.push('spool');}}if(s.spool.life<=0)s.spool=null;}
 if(s.time>=s.nextSpool&&!s.spool){const p=ps[Math.floor(random(s)*ps.length)];s.spool={x:p.x+p.w*(.2+random(s)*.6),y:p.y-45,life:C.spoolLife};s.nextSpool=s.time+C.spoolMin+random(s)*(C.spoolMax-C.spoolMin);}
 if(s.stage==='lantern'){
  const h=s.scissors;if(h.warning>0){h.warning-=C.dt;if(h.warning<=0){h.active=.35;s.events.push('snip');for(let i=0;i<2;i++){const f=s.fighters[i];if(Math.abs(f.x-h.x)<C.scissorsWidth/2&&f.y>330)hit(s,i,C.scissorsDamage,C.scissorsBase,C.scissorsScale,0,-1,-1);}}}else if(h.active>0)h.active=Math.max(0,h.active-C.dt);else if(s.time>=s.nextScissors){h.x=450+random(s)*700;h.warning=C.scissorsWarning;s.nextScissors=s.time+C.scissorsMin+random(s)*(C.scissorsMax-C.scissorsMin);}
 }
 if(s.winner===null&&s.time>=C.duration&&!s.sudden){const[a,b]=s.fighters;if(a.stocks!==b.stocks)s.winner=a.stocks>b.stocks?0:1;else if(Math.abs(a.fray-b.fray)>1e-6)s.winner=a.fray<b.fray?0:1;else{s.sudden=true;a.fray=200;b.fray=200;s.events.push('sudden');}}
 return s;
}
export function camera(s:Match,aspect:number){const live=s.fighters.filter(f=>f.respawn<=0&&f.stocks>0),fs=live.length?live:s.fighters;const left=Math.min(...fs.map(f=>f.x))-145,right=Math.max(...fs.map(f=>f.x))+145,top=Math.min(...fs.map(f=>f.y))-210,bottom=Math.max(...fs.map(f=>f.y))+130;
 const w=Math.min(1600,Math.max(aspect<1.3?680:900,right-left,(bottom-top)*aspect));const h=w/aspect;return {x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};}
export const SAVE_KEY='stitch-arena.match.v1';
export function serialize(s:Match):string{return JSON.stringify(s);}
function finite(x:unknown,min:number,max:number):x is number{return typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;}
export function restore(raw:string|null):Match|null {
 if(!raw||raw.length>80000)return null;try{const s=JSON.parse(raw) as Match;
 if(s.version!==1||!STAGES.includes(s.stage)||!Number.isInteger(s.seed)||!finite(s.seed,0,4294967295)||!Number.isInteger(s.tick)||!finite(s.tick,0,1e7)||!finite(s.time,0,1e5)||!finite(s.countdown,0,3)||!(s.winner===null||s.winner===0||s.winner===1)||typeof s.sudden!=='boolean'||!Array.isArray(s.fighters)||s.fighters.length!==2)return null;
 const ftemplate=fighter('ember',0,1,3);
 for(const f of s.fighters){if(!CHARS.includes(f.char))return null;for(const k of Object.keys(ftemplate) as (keyof Fighter)[]){if(k==='char')continue;if(typeof ftemplate[k]==='number'&&!finite(f[k],-1e5,1e5))return null;if(typeof ftemplate[k]==='boolean'&&typeof f[k]!=='boolean')return null;}if(!['idle1','idle2','run','jump','punch','cast','hurt','tumble'].includes(f.pose)||!Number.isInteger(f.stocks)||f.stocks<0||f.stocks>3||f.fray<0||f.fray>300||f.jumps<0||f.jumps>2||![1,-1].includes(f.face))return null;}
 if(!Array.isArray(s.projectiles)||s.projectiles.length>100||!Array.isArray(s.effects)||s.effects.length>150||!Array.isArray(s.events)||s.events.length>100||s.events.some(e=>typeof e!=='string'))return null;
 for(const p of s.projectiles){if(!CHARS.includes(p.kind)||![0,1].includes(p.owner)||typeof p.wave!=='boolean')return null;for(const k of ['id','x','y','vx','vy','life'] as const)if(!finite(p[k],-1e5,1e5))return null;}
 for(const e of s.effects){if(!['hit','hook','number'].includes(e.kind))return null;for(const k of ['x','y','tx','ty','life','n'] as const)if(!finite(e[k],-1e5,1e5))return null;}
 for(const k of ['nextSpool','nextScissors','nextId'] as const)if(!finite(s[k],0,1e6))return null;
 if(s.spool&&(!finite(s.spool.x,-1000,3000)||!finite(s.spool.y,-1000,2000)||!finite(s.spool.life,0,10)))return null;
 if(!s.scissors||!finite(s.scissors.x,0,1600)||!finite(s.scissors.warning,-1,2)||!finite(s.scissors.active,0,1))return null;
 if(!Array.isArray(s.ai)||s.ai.length!==2)return null;for(const a of s.ai){if(!finite(a.next,0,1e6)||!finite(a.lastJump,0,1e6)||!a.input||Object.keys(idleInput()).some(k=>typeof a.input[k as keyof Input]!=='boolean'))return null;}
 return s;}catch{return null;}
}
