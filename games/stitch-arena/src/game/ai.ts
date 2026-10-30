import {CONFIG as C} from './config';
import {idleInput,platforms,random,type Match,type Input} from './sim';
// All decisions become ordinary player inputs. Decisions and RNG live in the match snapshot.
export function aiInput(s:Match,i:number,level:number,novice=false):Input {
 const l=Math.max(0,Math.min(5,level-1)),brain=s.ai[i],f=s.fighters[i],e=s.fighters[1-i];
 if(s.time<brain.next)return {...brain.input};
 brain.next=s.time+(novice?C.ai.novice.reaction:C.ai.reaction[l]);const input=idleInput();const dx=e.x-f.x,dy=e.y-f.y,main=platforms(s)[0];
 const outside=f.x<main.x+30||f.x>main.x+main.w-30,below=f.y>main.y+20;
 const accuracy=novice?C.ai.novice.accuracy:C.ai.accuracy[l],rescue=novice?C.ai.novice.rescue:C.ai.rescue[l],aggression=novice?C.ai.novice.aggression:C.ai.aggression[l];
 const offPlatform=!platforms(s).some(p=>f.x>p.x-10&&f.x<p.x+p.w+10&&Math.abs(f.y-p.y)<130);
 if((outside||below)&&!f.grounded){input.left=f.x>800;input.right=f.x<800;
  input.up=f.jumps<2&&random(s)<rescue;input.hook=!novice&&random(s)<rescue&&f.y>main.y-120;
 }else{
  const target=e.respawn>0?800:e.x;const distance=Math.abs(target-f.x);const dir=Math.sign(target-f.x);
  const safe=f.x+dir*70>main.x&&f.x+dir*70<main.x+main.w;
  if(distance>70&&(safe||offPlatform||dy>150)){input.left=dir<0;input.right=dir>0;}
  if(!safe&&f.grounded&&distance>180)input.up=random(s)<accuracy;
  if(dy<-120&&f.jumps<2&&random(s)<accuracy)input.up=true;
  if(s.projectiles.some(p=>p.owner!==i&&Math.abs(p.x-f.x)<230&&Math.abs(p.y-(f.y-60))<80)&&random(s)<accuracy)input.up=true;
  if(Math.abs(dx)<105&&Math.abs(dy)<100&&random(s)<aggression)input.punch=true;
  if(Math.abs(dx)<800&&Math.abs(dy)<125&&random(s)<aggression){input.spell=true;input.left=dx<0;input.right=dx>0;}
  if(Math.abs(dy)>80&&random(s)<accuracy){input.aimUp=dy<0;input.aimDown=dy>0;}
  if(!novice&&Math.abs(dx)>140&&Math.abs(dx)<390&&Math.abs(dy)<100&&random(s)<accuracy*.25)input.hook=true;
 }
 if(input.up&&brain.input.up)input.up=false;
 if(!novice&&random(s)>(.92+accuracy*.075)){input.left=false;input.right=false;input.spell=false;input.punch=false;}
 brain.input=input;return {...input};
}
