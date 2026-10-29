// Single source of truth for every runtime asset.
//
// relativePath is ALWAYS a fixed path like "textures/bg_base.webp" or
// "audio/sfx_tap.mp3" — never a full URL and never a leading "/". The resolver
// (src/services/assets.ts) prepends a base (?style → commonPath → /common/ →
// local) to each of these. poster.png is NOT here on purpose: it is a platform
// cover shipped at the dist root, never preloaded.

export type ImageKey =
  | 'plant1' | 'plant2' | 'plant3' | 'plant4' | 'plant5'
  | 'plant6' | 'plant7' | 'plant8' | 'plant9'
  | 'pot1' | 'pot2' | 'pot3' | 'pot4'
  | 'plot'
  | 'pillGreen' | 'pillGold' | 'sign'
  | 'iconDew' | 'iconSeedbag' | 'iconUpgrade'
  | 'iconSoundOn' | 'iconSoundOff' | 'iconLanguage'
  | 'iconSuncoin' | 'iconChest' | 'iconRebirth' | 'iconFlag' | 'iconCrit' | 'iconLock'
  | 'relicLens' | 'relicSun' | 'relicMoon' | 'relicBee' | 'relicClover' | 'relicThunder'
  | 'relicTrowel' | 'relicCloud' | 'relicLotus' | 'relicLadybug' | 'relicCan' | 'relicAcorn'
  | 'logo'
  | 'bgBase' | 'bgPortrait';

export type AudioKey =
  | 'bgm'
  | 'sfxTap' | 'sfxBuy' | 'sfxMerge' | 'sfxBig' | 'sfxUpgrade'
  | 'sfxClick' | 'sfxHover'
  | 'sfxCrit' | 'sfxStage' | 'sfxDraw' | 'sfxRebirth';

export const IMAGES: Record<ImageKey, string> = {
  plant1: 'textures/icon_plant_1.png',
  plant2: 'textures/icon_plant_2.png',
  plant3: 'textures/icon_plant_3.png',
  plant4: 'textures/icon_plant_4.png',
  plant5: 'textures/icon_plant_5.png',
  plant6: 'textures/icon_plant_6.png',
  plant7: 'textures/icon_plant_7.png',
  plant8: 'textures/icon_plant_8.png',
  plant9: 'textures/icon_plant_9.png',
  pot1: 'textures/seq_pot_tap_1.png',
  pot2: 'textures/seq_pot_tap_2.png',
  pot3: 'textures/seq_pot_tap_3.png',
  pot4: 'textures/seq_pot_tap_4.png',
  plot: 'textures/panel_plot.png',
  pillGreen: 'textures/panel_pill_green.png',
  pillGold: 'textures/panel_pill_gold.png',
  sign: 'textures/panel_sign.png',
  iconDew: 'textures/icon_dew.png',
  iconSeedbag: 'textures/icon_seedbag.png',
  iconUpgrade: 'textures/icon_upgrade.png',
  iconSoundOn: 'textures/icon_sound_on.png',
  iconSoundOff: 'textures/icon_sound_off.png',
  iconLanguage: 'textures/icon_language.png',
  iconSuncoin: 'textures/icon_suncoin.png',
  iconChest: 'textures/icon_chest.png',
  iconRebirth: 'textures/icon_rebirth.png',
  iconFlag: 'textures/icon_flag.png',
  iconCrit: 'textures/icon_crit.png',
  iconLock: 'textures/icon_lock.png',
  relicLens: 'textures/icon_relic_lens.png',
  relicSun: 'textures/icon_relic_sun.png',
  relicMoon: 'textures/icon_relic_moon.png',
  relicBee: 'textures/icon_relic_bee.png',
  relicClover: 'textures/icon_relic_clover.png',
  relicThunder: 'textures/icon_relic_thunder.png',
  relicTrowel: 'textures/icon_relic_trowel.png',
  relicCloud: 'textures/icon_relic_cloud.png',
  relicLotus: 'textures/icon_relic_lotus.png',
  relicLadybug: 'textures/icon_relic_ladybug.png',
  relicCan: 'textures/icon_relic_can.png',
  relicAcorn: 'textures/icon_relic_acorn.png',
  logo: 'textures/logo_base.png',
  bgBase: 'textures/bg_base.webp',
  bgPortrait: 'textures/bg_portrait.webp',
};

export const AUDIO: Record<AudioKey, string> = {
  bgm: 'audio/bgm_base.mp3',
  sfxTap: 'audio/sfx_tap.mp3',
  sfxBuy: 'audio/sfx_buy.mp3',
  sfxMerge: 'audio/sfx_merge.mp3',
  sfxBig: 'audio/sfx_big.mp3',
  sfxUpgrade: 'audio/sfx_upgrade.mp3',
  sfxClick: 'audio/sfx_click.mp3',
  sfxHover: 'audio/sfx_hover.mp3',
  sfxCrit: 'audio/sfx_crit.mp3',
  sfxStage: 'audio/sfx_stage.mp3',
  sfxDraw: 'audio/sfx_draw.mp3',
  sfxRebirth: 'audio/sfx_rebirth.mp3',
};

// Relic image keys in the same order as RELICS (PLAN §3.5, icons 1..12).
const RELIC_IMAGE_KEYS: ImageKey[] = [
  'relicLens', 'relicSun', 'relicMoon', 'relicBee', 'relicClover', 'relicThunder',
  'relicTrowel', 'relicCloud', 'relicLotus', 'relicLadybug', 'relicCan', 'relicAcorn',
];

/** Relic index (0..11) → its image key. */
export function relicImageKey(index: number): ImageKey {
  return RELIC_IMAGE_KEYS[index] ?? 'relicLens';
}

/** Plant level (1..9) → its image key. */
export function plantImageKey(level: number): ImageKey {
  return `plant${Math.min(9, Math.max(1, level))}` as ImageKey;
}

/** Pot animation frame (1..4) → image key. */
export function potFrameKey(frame: number): ImageKey {
  return `pot${Math.min(4, Math.max(1, frame))}` as ImageKey;
}
