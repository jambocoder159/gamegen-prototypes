// Single source of truth for every runtime asset.
//
// relativePath is ALWAYS a fixed path like "textures/bg_base.webp" or
// "audio/sfx_move.mp3" — never a full URL and never a leading "/". The resolver
// (src/services/assets.ts) prepends a base (?style → commonPath → /common/ →
// local) to each of these. poster.png is NOT here on purpose: it is a platform
// cover shipped at the dist root, never preloaded.

export type ImageKey =
  | 'tile1' | 'tile2' | 'tile3' | 'tile4' | 'tile5'
  | 'tile6' | 'tile7' | 'tile8' | 'tile9'
  | 'board' | 'cell'
  | 'pillPink' | 'pillMint'
  | 'iconRestart' | 'iconSoundOn' | 'iconSoundOff' | 'iconLanguage'
  | 'logo'
  | 'bgBase' | 'bgPortrait';

export type AudioKey =
  | 'bgm'
  | 'sfxMove' | 'sfxMerge' | 'sfxWin' | 'sfxOver' | 'sfxClick' | 'sfxHover';

export const IMAGES: Record<ImageKey, string> = {
  tile1: 'textures/icon_mochi_plain.png',
  tile2: 'textures/icon_mochi_sakura.png',
  tile3: 'textures/icon_mochi_matcha.png',
  tile4: 'textures/icon_mochi_bean.png',
  tile5: 'textures/icon_mochi_strawberry.png',
  tile6: 'textures/icon_mochi_mango.png',
  tile7: 'textures/icon_mochi_taro.png',
  tile8: 'textures/icon_mochi_star.png',
  tile9: 'textures/icon_mochi_dragon.png',
  board: 'textures/panel_board.png',
  cell: 'textures/panel_cell.png',
  pillPink: 'textures/panel_pill_pink.png',
  pillMint: 'textures/panel_pill_mint.png',
  iconRestart: 'textures/icon_restart.png',
  iconSoundOn: 'textures/icon_sound_on.png',
  iconSoundOff: 'textures/icon_sound_off.png',
  iconLanguage: 'textures/icon_language.png',
  logo: 'textures/logo_base.png',
  bgBase: 'textures/bg_base.webp',
  bgPortrait: 'textures/bg_portrait.webp',
};

// sfx_spawn is intentionally absent: spawns are silent (see PLAN / brief), and
// the file public/common/audio/sfx_spawn.mp3 is deleted (zero-residue rule).
export const AUDIO: Record<AudioKey, string> = {
  bgm: 'audio/bgm_base.mp3',
  sfxMove: 'audio/sfx_move.mp3',
  sfxMerge: 'audio/sfx_merge.mp3',
  sfxWin: 'audio/sfx_win.mp3',
  sfxOver: 'audio/sfx_over.mp3',
  sfxClick: 'audio/sfx_click.mp3',
  sfxHover: 'audio/sfx_hover.mp3',
};

/** Tile tier (1..9) → image key. */
export function tileImageKey(tier: number): ImageKey {
  return `tile${Math.min(tier, 9)}` as ImageKey;
}
