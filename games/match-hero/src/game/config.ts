export const CONFIG = {
 size:6,enemyHp:400,hpGrowth:1.28,enemyAtk:.2,atkGrowth:1.09,enemyInterval:2.2,bossHp:6,bossAtk:1.6,bossInterval:1.8,killGold:8,killGrowth:1.16,autoGold:1.5,autoSp:1,floorGold:15,spMax:100,comboStep:.25,
 skills:{fireball:{cost:30,cooldown:2},heal:{cost:40,cooldown:2},haste:{cost:25,cooldown:8}},
 upgrades:{atk:{base:20,growth:1.20,cap:1000},speed:{base:60,growth:1.28,cap:50},crit:{base:80,growth:1.30,cap:55},hp:{base:30,growth:1.22,cap:1000},power:{base:100,growth:1.30,cap:60},gold:{base:70,growth:1.28,cap:80},focus:{base:150,growth:1.35,cap:40}}
} as const;
export type Upgrade=keyof typeof CONFIG.upgrades;
export type Skill=keyof typeof CONFIG.skills;
