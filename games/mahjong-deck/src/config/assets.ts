// Single source of truth for every runtime asset.
//
// relativePath is ALWAYS a fixed path like "textures/bg_base.webp" or
// "audio/sfx_match.mp3" — never a full URL and never a leading "/". The resolver
// (src/services/assets.ts) prepends a base (?style → commonPath → /common/ →
// local) to each of these. poster.png is NOT here on purpose: it is a platform
// cover shipped at the dist root, never preloaded.

// The 16 tile faces (a stage uses the first N). Order is fixed: the deal uses
// the first K entries so lower stages always draw the same recognisable set.
export type TileKey =
  | 'bamboo' | 'dots' | 'coin' | 'koi' | 'peach' | 'plum' | 'orchid' | 'lantern'
  | 'fan' | 'crane' | 'pagoda' | 'moon' | 'sun' | 'tea' | 'dragon' | 'cat';

export const TILE_KEYS: TileKey[] = [
  'bamboo', 'dots', 'coin', 'koi', 'peach', 'plum', 'orchid', 'lantern',
  'fan', 'crane', 'pagoda', 'moon', 'sun', 'tea', 'dragon', 'cat',
];

// The 6 ability cards.
export type CardKey = 'hint' | 'shuffle' | 'undo' | 'wild' | 'heal' | 'combo';

export const CARD_KEYS: CardKey[] = ['hint', 'shuffle', 'undo', 'wild', 'heal', 'combo'];

export type ImageKey =
  | `tile${Capitalize<TileKey>}`
  | `card${Capitalize<CardKey>}`
  | 'pillFelt' | 'pillGold'
  | 'iconHeart' | 'iconStar' | 'iconRestart' | 'iconSoundOn' | 'iconSoundOff'
  | 'iconLanguage'
  | 'logo'
  | 'dealer1' | 'dealer2' | 'dealer3' | 'dealer4'
  | 'bgBase' | 'bgPortrait';

export type AudioKey =
  | 'bgm'
  | 'sfxSelect' | 'sfxMatch' | 'sfxWrong' | 'sfxCard'
  | 'sfxClear' | 'sfxWin' | 'sfxLose'
  | 'sfxClick' | 'sfxHover';

function cap<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

const tileImages = Object.fromEntries(
  TILE_KEYS.map((k) => [`tile${cap(k)}`, `textures/icon_tile_${k}.png`]),
) as Record<`tile${Capitalize<TileKey>}`, string>;

const cardImages = Object.fromEntries(
  CARD_KEYS.map((k) => [`card${cap(k)}`, `textures/card_${k}.png`]),
) as Record<`card${Capitalize<CardKey>}`, string>;

export const IMAGES: Record<ImageKey, string> = {
  ...tileImages,
  ...cardImages,
  pillFelt: 'textures/panel_pill_felt.png',
  pillGold: 'textures/panel_pill_gold.png',
  iconHeart: 'textures/icon_heart.png',
  iconStar: 'textures/icon_star.png',
  iconRestart: 'textures/icon_restart.png',
  iconSoundOn: 'textures/icon_sound_on.png',
  iconSoundOff: 'textures/icon_sound_off.png',
  iconLanguage: 'textures/icon_language.png',
  logo: 'textures/logo_base.png',
  dealer1: 'textures/seq_dealer_deal_1.png',
  dealer2: 'textures/seq_dealer_deal_2.png',
  dealer3: 'textures/seq_dealer_deal_3.png',
  dealer4: 'textures/seq_dealer_deal_4.png',
  bgBase: 'textures/bg_base.webp',
  bgPortrait: 'textures/bg_portrait.webp',
};

export const AUDIO: Record<AudioKey, string> = {
  bgm: 'audio/bgm_base.mp3',
  sfxSelect: 'audio/sfx_select.mp3',
  sfxMatch: 'audio/sfx_match.mp3',
  sfxWrong: 'audio/sfx_wrong.mp3',
  sfxCard: 'audio/sfx_card.mp3',
  sfxClear: 'audio/sfx_clear.mp3',
  sfxWin: 'audio/sfx_win.mp3',
  sfxLose: 'audio/sfx_lose.mp3',
  sfxClick: 'audio/sfx_click.mp3',
  sfxHover: 'audio/sfx_hover.mp3',
};

/** Tile type id (0..15) → its image key. */
export function tileImageKey(type: number): ImageKey {
  return `tile${cap(TILE_KEYS[type])}` as ImageKey;
}

/** Card key → its image key. */
export function cardImageKey(card: CardKey): ImageKey {
  return `card${cap(card)}` as ImageKey;
}

/** Dealer frame (0..3) → image key. */
export function dealerFrameKey(frame: number): ImageKey {
  return `dealer${(frame % 4) + 1}` as ImageKey;
}
