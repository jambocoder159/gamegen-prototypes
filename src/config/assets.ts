// Single source of truth for every runtime asset.
//
// relativePath is ALWAYS a fixed path like "textures/bg_base.webp" or
// "audio/sfx_pick.mp3" — never a full URL and never a leading "/". The resolver
// (src/services/assets.ts) prepends a base (?style → commonPath → /common/ →
// local) to each of these. poster.png is NOT here on purpose: it is a platform
// cover shipped at the dist root, never preloaded.

export type GoodsKey =
  | 'milk' | 'soda' | 'cereal' | 'jam' | 'tuna' | 'juice' | 'chips' | 'soap';

/** Goods type id (0..7) → asset/i18n key. The first K are used on each level. */
export const GOODS_KEYS: GoodsKey[] = [
  'milk', 'soda', 'cereal', 'jam', 'tuna', 'juice', 'chips', 'soap',
];

export type ImageKey =
  | 'goodsMilk' | 'goodsSoda' | 'goodsCereal' | 'goodsJam'
  | 'goodsTuna' | 'goodsJuice' | 'goodsChips' | 'goodsSoap'
  | 'shelf'
  | 'pillTeal' | 'pillOrange'
  | 'iconRestart' | 'iconUndo' | 'iconSoundOn' | 'iconSoundOff'
  | 'iconLanguage' | 'iconStar'
  | 'logo'
  | 'clerk1' | 'clerk2' | 'clerk3' | 'clerk4'
  | 'bgBase' | 'bgPortrait';

export type AudioKey =
  | 'bgm'
  | 'sfxPick' | 'sfxPlace' | 'sfxClear' | 'sfxWin' | 'sfxNope'
  | 'sfxClick' | 'sfxHover';

export const IMAGES: Record<ImageKey, string> = {
  goodsMilk: 'textures/icon_goods_milk.png',
  goodsSoda: 'textures/icon_goods_soda.png',
  goodsCereal: 'textures/icon_goods_cereal.png',
  goodsJam: 'textures/icon_goods_jam.png',
  goodsTuna: 'textures/icon_goods_tuna.png',
  goodsJuice: 'textures/icon_goods_juice.png',
  goodsChips: 'textures/icon_goods_chips.png',
  goodsSoap: 'textures/icon_goods_soap.png',
  shelf: 'textures/panel_shelf.png',
  pillTeal: 'textures/panel_pill_teal.png',
  pillOrange: 'textures/panel_pill_orange.png',
  iconRestart: 'textures/icon_restart.png',
  iconUndo: 'textures/icon_undo.png',
  iconSoundOn: 'textures/icon_sound_on.png',
  iconSoundOff: 'textures/icon_sound_off.png',
  iconLanguage: 'textures/icon_language.png',
  iconStar: 'textures/icon_star.png',
  logo: 'textures/logo_base.png',
  clerk1: 'textures/seq_clerk_cheer_1.png',
  clerk2: 'textures/seq_clerk_cheer_2.png',
  clerk3: 'textures/seq_clerk_cheer_3.png',
  clerk4: 'textures/seq_clerk_cheer_4.png',
  bgBase: 'textures/bg_base.webp',
  bgPortrait: 'textures/bg_portrait.webp',
};

export const AUDIO: Record<AudioKey, string> = {
  bgm: 'audio/bgm_base.mp3',
  sfxPick: 'audio/sfx_pick.mp3',
  sfxPlace: 'audio/sfx_place.mp3',
  sfxClear: 'audio/sfx_clear.mp3',
  sfxWin: 'audio/sfx_win.mp3',
  sfxNope: 'audio/sfx_nope.mp3',
  sfxClick: 'audio/sfx_click.mp3',
  sfxHover: 'audio/sfx_hover.mp3',
};

const GOODS_IMAGE: Record<GoodsKey, ImageKey> = {
  milk: 'goodsMilk',
  soda: 'goodsSoda',
  cereal: 'goodsCereal',
  jam: 'goodsJam',
  tuna: 'goodsTuna',
  juice: 'goodsJuice',
  chips: 'goodsChips',
  soap: 'goodsSoap',
};

/** Goods type id (0..7) → its image key. */
export function goodsImageKey(type: number): ImageKey {
  return GOODS_IMAGE[GOODS_KEYS[type]];
}

/** Clerk cheer frame (0..3) → image key. */
export function clerkFrameKey(frame: number): ImageKey {
  return (`clerk${(frame % 4) + 1}`) as ImageKey;
}
