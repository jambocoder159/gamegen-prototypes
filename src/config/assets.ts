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
  | 'pillGreen' | 'pillGold'
  | 'iconDew' | 'iconSeedbag' | 'iconUpgrade'
  | 'iconSoundOn' | 'iconSoundOff' | 'iconLanguage'
  | 'logo'
  | 'bgBase' | 'bgPortrait';

export type AudioKey =
  | 'bgm'
  | 'sfxTap' | 'sfxBuy' | 'sfxMerge' | 'sfxBig' | 'sfxUpgrade'
  | 'sfxClick' | 'sfxHover';

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
  iconDew: 'textures/icon_dew.png',
  iconSeedbag: 'textures/icon_seedbag.png',
  iconUpgrade: 'textures/icon_upgrade.png',
  iconSoundOn: 'textures/icon_sound_on.png',
  iconSoundOff: 'textures/icon_sound_off.png',
  iconLanguage: 'textures/icon_language.png',
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
};

/** Plant level (1..9) → its image key. */
export function plantImageKey(level: number): ImageKey {
  return `plant${Math.min(9, Math.max(1, level))}` as ImageKey;
}

/** Pot animation frame (1..4) → image key. */
export function potFrameKey(frame: number): ImageKey {
  return `pot${Math.min(4, Math.max(1, frame))}` as ImageKey;
}
