import {start,finish} from './browser-utils.mjs';
import {verifyHud} from './hud-overlap.mjs';
const{browser,url,stop}=await start();
try{await verifyHud(browser,url);}finally{await stop();}
finish();
