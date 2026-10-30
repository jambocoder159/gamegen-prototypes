import {start,finish} from './browser-utils.mjs';
import {panelChecks} from './panels-test.mjs';
import {verifyHud} from './hud-overlap.mjs';
const{browser,url,stop}=await start();
try{await verifyHud(browser,url);await panelChecks(browser,url);}finally{await stop();}
finish();
