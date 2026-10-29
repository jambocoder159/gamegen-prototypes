// Single table of fixed relativePaths (never a full URL, never a leading '/').
// Resolved independently per asset by src/services/assets.ts.

export type ImageKey =
  | 'bg_base'
  | 'bg_portrait'
  | 'logo'
  | 'bowl'
  | 'coin'
  | 'heart'
  | 'panel_bubble'
  | 'panel_button'
  | 'panel_bar'
  | 'icon_restart'
  | 'icon_sound_on'
  | 'icon_sound_off'
  | 'icon_language'
  | 'egg'
  | 'scallion'
  | 'pork'
  | 'fishcake'
  | 'chili'
  | 'bokchoy'
  | 'chef_1'
  | 'chef_2'
  | 'chef_3'
  | 'chef_4'
  | 'cat_wait'
  | 'cat_happy'
  | 'cat_angry'
  | 'bear_wait'
  | 'bear_happy'
  | 'bear_angry'
  | 'fox_wait'
  | 'fox_happy'
  | 'fox_angry'
  | 'rabbit_wait'
  | 'rabbit_happy'
  | 'rabbit_angry';

export const IMAGE_ASSETS: Record<ImageKey, string> = {
  bg_base: 'textures/bg_base.webp',
  bg_portrait: 'textures/bg_portrait.webp',
  logo: 'textures/logo_base.png',
  bowl: 'textures/icon_bowl.png',
  coin: 'textures/icon_coin.png',
  heart: 'textures/icon_heart.png',
  panel_bubble: 'textures/panel_bubble.png',
  panel_button: 'textures/panel_button.png',
  panel_bar: 'textures/panel_bar.png',
  icon_restart: 'textures/icon_restart.png',
  icon_sound_on: 'textures/icon_sound_on.png',
  icon_sound_off: 'textures/icon_sound_off.png',
  icon_language: 'textures/icon_language.png',
  egg: 'textures/icon_egg.png',
  scallion: 'textures/icon_scallion.png',
  pork: 'textures/icon_pork.png',
  fishcake: 'textures/icon_fishcake.png',
  chili: 'textures/icon_chili.png',
  bokchoy: 'textures/icon_bokchoy.png',
  chef_1: 'textures/seq_chef_stir_1.png',
  chef_2: 'textures/seq_chef_stir_2.png',
  chef_3: 'textures/seq_chef_stir_3.png',
  chef_4: 'textures/seq_chef_stir_4.png',
  cat_wait: 'textures/deco_customer_cat_wait.png',
  cat_happy: 'textures/deco_customer_cat_happy.png',
  cat_angry: 'textures/deco_customer_cat_angry.png',
  bear_wait: 'textures/deco_customer_bear_wait.png',
  bear_happy: 'textures/deco_customer_bear_happy.png',
  bear_angry: 'textures/deco_customer_bear_angry.png',
  fox_wait: 'textures/deco_customer_fox_wait.png',
  fox_happy: 'textures/deco_customer_fox_happy.png',
  fox_angry: 'textures/deco_customer_fox_angry.png',
  rabbit_wait: 'textures/deco_customer_rabbit_wait.png',
  rabbit_happy: 'textures/deco_customer_rabbit_happy.png',
  rabbit_angry: 'textures/deco_customer_rabbit_angry.png',
};

export type AudioKey =
  | 'bgm_base'
  | 'sfx_add'
  | 'sfx_click'
  | 'sfx_hover'
  | 'sfx_ok'
  | 'sfx_over'
  | 'sfx_serve'
  | 'sfx_wrong';

export const AUDIO_ASSETS: Record<AudioKey, string> = {
  bgm_base: 'audio/bgm_base.mp3',
  sfx_add: 'audio/sfx_add.mp3',
  sfx_click: 'audio/sfx_click.mp3',
  sfx_hover: 'audio/sfx_hover.mp3',
  sfx_ok: 'audio/sfx_ok.mp3',
  sfx_over: 'audio/sfx_over.mp3',
  sfx_serve: 'audio/sfx_serve.mp3',
  sfx_wrong: 'audio/sfx_wrong.mp3',
};
