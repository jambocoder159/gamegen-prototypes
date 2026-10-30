export const CHARS = ['ember','frost','gale','rune'] as const;
export type Character = typeof CHARS[number];
export const STAGES = ['meadow','lantern','ice'] as const;
export type Stage = typeof STAGES[number];
export const CONFIG = {
  dt:1/60, gravity:2400, fallMax:1500, acceleration:3400, friction:2400, airFriction:300,
  width:56, height:104, visualHeight:142, stocks:3, duration:120, countdown:3,
  blast:{left:-250,right:1850,top:-400,bottom:1150},
  punch:{cooldown:.35,damage:6,base:290,scale:7.4,range:106},
  hook:{cooldown:2.5,miss:1,range:420,damage:4},
  burn:{duration:2,rate:2},chill:{duration:1.5,speedFactor:.6},
  hitstun:{min:.15,max:.6,divisor:6000},rock:{gravity:1400,waveSpeed:550,waveLife:.4},
  respawn:1.5,invuln:2,spoolMin:12,spoolMax:18,spoolLife:10,shield:6,
  scissorsMin:6,scissorsMax:9,scissorsWarning:1,scissorsWidth:120,scissorsDamage:10,scissorsBase:850,scissorsScale:6,
  unravelStart:60,unravelSpeed:30,unravelMin:300,
  chars:{
    ember:{speed:360,jump:960,weight:1,spellCd:1.2,projectile:720,damage:9,base:330,scale:7.8},
    frost:{speed:380,jump:980,weight:.9,spellCd:1,projectile:900,damage:6,base:300,scale:7.8},
    gale:{speed:400,jump:920,weight:.8,spellCd:1.4,projectile:520,damage:3,base:420,scale:9.4},
    rune:{speed:320,jump:900,weight:1.25,spellCd:1.8,projectile:670,damage:12,base:440,scale:9}
  },
  ai:{reaction:[.55,.44,.34,.25,.18,.12],accuracy:[.24,.38,.52,.66,.83,.96],rescue:[.3,.43,.56,.7,.83,.95],aggression:[.08,.35,.54,.72,.86,.98],novice:{reaction:.5,accuracy:.64,rescue:.75,aggression:.65}},
  // Measured texture top at centre, divided by texture width; feet are 8px above canvas bottom.
  surfaceInset:{meadow:{main:0.0377,small:.07},lantern:{main:0.0399,small:.055},ice:{main:0.0420,small:.065}}
} as const;
