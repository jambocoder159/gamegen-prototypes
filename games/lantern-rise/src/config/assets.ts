// Single source of truth for every loadable asset.
// relativePaths are fixed and relative (never a full URL, never a leading slash);
// the asset resolver turns them into real URLs at load time.

export interface ImageAsset {
  readonly key: string;
  readonly path: string;
  readonly w: number;
  readonly h: number;
}

export interface AudioAsset {
  readonly key: string;
  readonly path: string;
}

export const IMAGE_ASSETS = [
  { key: 'bg_base', path: 'textures/bg_base.webp', w: 1280, h: 720 },
  { key: 'bg_portrait', path: 'textures/bg_portrait.webp', w: 720, h: 1280 },
  { key: 'deco_hills', path: 'textures/deco_hills.png', w: 1280, h: 239 },
  { key: 'deco_storm', path: 'textures/deco_storm.png', w: 419, h: 379 },
  { key: 'icon_flame', path: 'textures/icon_flame.png', w: 217, h: 357 },
  { key: 'icon_language', path: 'textures/icon_language.png', w: 358, h: 370 },
  { key: 'icon_restart', path: 'textures/icon_restart.png', w: 358, h: 366 },
  { key: 'icon_sound_off', path: 'textures/icon_sound_off.png', w: 357, h: 370 },
  { key: 'icon_sound_on', path: 'textures/icon_sound_on.png', w: 359, h: 366 },
  { key: 'icon_spark', path: 'textures/icon_spark.png', w: 342, h: 352 },
  { key: 'logo_base', path: 'textures/logo_base.png', w: 648, h: 581 },
  { key: 'panel_meter', path: 'textures/panel_meter.png', w: 941, h: 116 },
  { key: 'panel_pill', path: 'textures/panel_pill.png', w: 885, h: 191 },
  { key: 'seq_crow_fly_1', path: 'textures/seq_crow_fly_1.png', w: 375, h: 349 },
  { key: 'seq_crow_fly_2', path: 'textures/seq_crow_fly_2.png', w: 375, h: 349 },
  { key: 'seq_crow_fly_3', path: 'textures/seq_crow_fly_3.png', w: 375, h: 349 },
  { key: 'seq_crow_fly_4', path: 'textures/seq_crow_fly_4.png', w: 375, h: 349 },
  { key: 'seq_lantern_idle_1', path: 'textures/seq_lantern_idle_1.png', w: 265, h: 391 },
  { key: 'seq_lantern_idle_2', path: 'textures/seq_lantern_idle_2.png', w: 265, h: 391 },
  { key: 'seq_lantern_idle_3', path: 'textures/seq_lantern_idle_3.png', w: 265, h: 391 },
  { key: 'seq_lantern_idle_4', path: 'textures/seq_lantern_idle_4.png', w: 265, h: 391 },
] as const satisfies readonly ImageAsset[];

export const AUDIO_ASSETS = [
  { key: 'bgm_base', path: 'audio/bgm_base.mp3' },
  { key: 'sfx_click', path: 'audio/sfx_click.mp3' },
  { key: 'sfx_collect', path: 'audio/sfx_collect.mp3' },
  { key: 'sfx_fuel', path: 'audio/sfx_fuel.mp3' },
  { key: 'sfx_hit', path: 'audio/sfx_hit.mp3' },
  { key: 'sfx_hover', path: 'audio/sfx_hover.mp3' },
  { key: 'sfx_over', path: 'audio/sfx_over.mp3' },
] as const satisfies readonly AudioAsset[];

export type ImageKey = (typeof IMAGE_ASSETS)[number]['key'];
export type AudioKey = (typeof AUDIO_ASSETS)[number]['key'];

export const CROW_FRAMES: ImageKey[] = [
  'seq_crow_fly_1',
  'seq_crow_fly_2',
  'seq_crow_fly_3',
  'seq_crow_fly_4',
];

export const LANTERN_FRAMES: ImageKey[] = [
  'seq_lantern_idle_1',
  'seq_lantern_idle_2',
  'seq_lantern_idle_3',
  'seq_lantern_idle_4',
];
